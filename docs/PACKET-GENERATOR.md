# Addendum: Packet Generator (extends F16 of PRD-MONTESSORI.md)

| | |
|---|---|
| **Status** | Built (M1 of the scope below); illustrated cards pending an image-gen provider |
| **Replaces** | [PRD-MONTESSORI.md §7 F16](PRD-MONTESSORI.md#f16-printable-templates-and-exports) ("Printable templates and exports") with a real feature |
| **Origin** | Adapted from an external "Automated Montessori Fabrication Engine" PRD, fit to KidHub's existing schema, auth and AI integration instead of the Python/GCS/SIS stack it originally specified |

## 1. What it is

A teacher or a full guardian types a curiosity question — *"Parts of a honeybee"*, *"Why do leaves change color?"* — picks a developmental plane and subject area, and gets back a printable Montessori packet in a few seconds: an AI-drafted vocabulary set, a short "Cosmic Story Hook," and a hands-on Control of Error activity, compiled into a PDF with KidHub's Montessori color-coding.

It lives at **Packet Generator** in the staff nav and **Packet Generator** under My family, backed by `supabase/migrations/0003_packets.sql`.

## 2. Why fold it into KidHub rather than ship it standalone

The source PRD proposed a separate product: its own personas, its own FERPA/COPPA/SOC 2 compliance dashboard, SIS roster sync, a Python/LangChain backend, GCS storage and a GPU segmentation model (SAM2). That's enterprise scaffolding for a tool that itself states it needs zero student PII — and it would rebuild auth, tenancy and AI plumbing KidHub already has.

Instead: reuse `is_staff` / `is_full_guardian` RLS, the `media`-bucket storage pattern, the existing Anthropic SDK integration, and the Teacher/Director/Parent personas already in `src/app/(app)/`. The color-coding (`SUBJECT_COLOR` in `src/lib/domain/packets.ts`) deliberately mirrors the curriculum areas already named in PRD-MONTESSORI.md §3 (Practical Life, Sensorial, Language, Mathematics, Cultural) so a future `lesson_id` column can be added without renaming anything.

## 3. What ships today vs. later

| Source spec (Subsystem) | This build |
|---|---|
| A — Curriculum agent + fact-check gate | **Shipped.** `src/lib/ai/packets.ts`: Claude drafts the manifest against a strict shape (`src/lib/domain/packets.ts`), with one repair retry on a validation failure, plus a deny-list scan for grading/ranking/comparison language (reusing the rule already in PRD-MONTESSORI.md §8). |
| B — Illustrations + SAM2 segmentation + VLM judge | **Judge shipped, images pending.** `judgeIllustration()` reuses Claude's own vision input instead of a separate VLM API — no code to write there. `src/lib/images/provider.ts` is a clean seam for a real provider; until one is configured, the pipeline simply skips illustrated cards. SAM2 segmentation was dropped: once a provider exists, ask it directly for a "highlight only X in crimson, nothing else changes" variant and let the judge catch failures, rather than running a GPU segmentation model from Vercel. |
| C — ReportLab/WeasyPrint PDF compiler | **Shipped, rebuilt.** Python PDF libraries don't run on Vercel. `src/lib/pdf/packet-compiler.ts` renders the same card geometry (control/picture/label-strip/definition-card sizes, 0.25pt crop marks, duplex-mirrored backs) on top of a small hand-rolled PDF writer (`src/lib/pdf/pdf-writer.ts`) — added with no new npm dependency after `pdf-lib` turned out to be unreachable from this environment's network; if that changes, swapping in a real PDF library instead of growing the hand-rolled one is the better long-term move. |

Without an image provider, a packet today is: a story/cover page, label strips (Primary) or duplex definition cards (Elementary — front term + phonetic breakdown, back reveals the definition as a self-check), and the Control of Error activity with its verification key on the back. No illustrated picture/control cards yet — `imageGenerationConfigured()` gates that, and the UI says so plainly rather than pretending otherwise.

## 4. Cut from the source spec, and why

- **FERPA/SIS/SOC 2 dashboards, PowerSchool sync** — the packet pipeline needs no student PII to run; KidHub's existing privacy/audit posture already covers the one place it touches real data (an optional `child_id` tag). Re-add only if a school specifically asks.
- **Director "Curiosity Leaderboard" analytics, governance toggles** — v2 material once there's real usage to show.
- **SAM2 segmentation** — see §3.
- **Background job queue for the image pipeline** — not needed yet because there's no image pipeline running; revisit once Subsystem B goes live, since a multi-image generate→judge→retry loop will likely exceed a single Vercel request's comfortable duration.

## 5. Guardrails already in place

- Rate-limited per user (`packetUser`: 10/hour, `src/lib/security/rate-limit.ts`), same mechanism as the AI assistant.
- RLS scopes every row to the request's school and, when tagged to a child, to that child's full guardians — `school_id` is pinned by trigger so a request can never move between schools.
- The same "AI answers and drafts; people decide" posture: nothing is sent anywhere automatically — the compiled PDF sits behind a signed URL the requester opens and prints themselves.

## 6. Open follow-ups

1. Pick and wire an image-generation provider in `src/lib/images/provider.ts`, then move the pipeline to a background job before enabling it broadly.
2. Once PRD-MONTESSORI.md's curriculum library (F2) ships, add a nullable `lesson_id` to `packet_requests` so a packet can attach to a real lesson instead of a free-text topic, and surface "Generate a packet for this" from F3.5's "Ready for next" suggestions.
3. Re-run `npm run typecheck`, `npm test`, `npm run test:db` and `npm run build` once `npm install` can reach the registry from wherever this is deployed — it couldn't from this session's sandbox (see the PR description), so this change is verified structurally (a standalone byte-level check of the PDF writer, saved as `sample-packet.pdf`) and via the existing domain test suite, but not through the project's full pipeline.
