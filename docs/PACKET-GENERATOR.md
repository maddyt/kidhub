# Addendum: Packet Generator (extends F16 of PRD-MONTESSORI.md)

| | |
|---|---|
| **Status** | Built, including illustrated picture cards via fal.ai/FLUX (set `FAL_API_KEY` to enable) |
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
| B — Illustrations + SAM2 segmentation + VLM judge | **Shipped**, minus SAM2. `src/lib/images/provider.ts` calls fal.ai (FLUX Schnell) via plain `fetch` — chosen over a GPU segmentation pipeline for the same reason SAM2 was dropped (see below), and because it's a synchronous single-call API (no job polling) that typically returns in a few seconds. `judgeIllustration()` (`src/lib/ai/packets.ts`) reuses Claude's own vision input as the VLM judge rather than a separate API. `src/lib/packets/illustrations.ts` generates + judges up to `MAX_ILLUSTRATED_TERMS` (4) terms **in parallel**, 2 attempts each, and simply skips a term that fails every attempt or comes back in a format the PDF writer can't embed (PNG) — the packet still compiles without it. Runs for free with no provider configured (`imageGenerationConfigured()` short-circuits). |
| C — ReportLab/WeasyPrint PDF compiler | **Shipped, rebuilt, now embeds images.** Python PDF libraries don't run on Vercel. `src/lib/pdf/packet-compiler.ts` renders the same card geometry (control/picture/label-strip/definition-card sizes, 0.25pt crop marks, duplex-mirrored backs) on top of a small hand-rolled PDF writer (`src/lib/pdf/pdf-writer.ts`) — added with no new npm dependency after `pdf-lib` turned out to be unreachable from this environment's network. `pdf-writer.ts` now also embeds baseline/progressive JPEGs directly as DCTDecode Image XObjects (parsing width/height from the JPEG's own SOF marker, no decoding of pixel data) — PNG isn't supported, so a non-JPEG result from the provider is dropped rather than mishandled. If this needs more than that, swap in a real PDF library instead of growing the hand-rolled one. |

A packet with `FAL_API_KEY` set gets, per illustrated term (up to 4): a picture card (the FLUX illustration + the term name), in addition to the existing label strips (Primary) or duplex definition cards (Elementary) and the Control of Error activity. Without a key, it's exactly the text-only packet described above — `imageGenerationConfigured()` gates the picture cards and the UI's "no image provider configured" notice, and nothing else changes.

**Known simplification:** the source spec's "parts-of" anatomical sets call for one base illustration plus a pixel-identical crimson-highlighted variant per term (via SAM2 segmentation). This build generates one illustration per term and does not also generate a separate highlighted variant — doing so would double the image calls (cost and the time budget below) for a feature with no real usage data yet. `highlight_region` is still in the manifest and `generateIllustration()`/`judgeIllustration()` both already accept a highlight instruction, so adding the second variant later is additive, not a rewrite.

## 4. Cut from the source spec, and why

- **FERPA/SIS/SOC 2 dashboards, PowerSchool sync** — the packet pipeline needs no student PII to run; KidHub's existing privacy/audit posture already covers the one place it touches real data (an optional `child_id` tag). Re-add only if a school specifically asks.
- **Director "Curiosity Leaderboard" analytics, governance toggles** — v2 material once there's real usage to show.
- **SAM2 segmentation** — see §3; FLUX is prompted directly for a highlighted variant instead, with the VLM judge catching an illustration that drifted too far.
- **A background job queue for the image pipeline** — `src/lib/packets/illustrations.ts` generates all illustrations for one packet in parallel (`Promise.allSettled`) rather than queuing them, so the whole request still fits in one Vercel function call (`maxDuration = 60` on both packet-request actions). This is a real time budget, not a generous one: watch for timeouts as usage grows, and move to a background job before raising `MAX_ILLUSTRATED_TERMS` or adding the highlighted-variant pass above.

## 5. Guardrails already in place

- Rate-limited per user (`packetUser`: 10/hour, `src/lib/security/rate-limit.ts`), same mechanism as the AI assistant.
- RLS scopes every row to the request's school and, when tagged to a child, to that child's full guardians — `school_id` is pinned by trigger so a request can never move between schools.
- The same "AI answers and drafts; people decide" posture: nothing is sent anywhere automatically — the compiled PDF sits behind a signed URL the requester opens and prints themselves.

## 6. Open follow-ups

1. If usage grows: move image generation to a background job instead of inline in the request, and/or raise `MAX_ILLUSTRATED_TERMS` past 4 — not before, given the `maxDuration = 60` budget.
2. Add the highlighted-variant pass (base image + a separate crimson-highlighted image per term) once there's real usage to justify doubling the image calls — see §3's "Known simplification."
3. Once PRD-MONTESSORI.md's curriculum library (F2) ships, add a nullable `lesson_id` to `packet_requests` so a packet can attach to a real lesson instead of a free-text topic, and surface "Generate a packet for this" from F3.5's "Ready for next" suggestions.
4. Re-run `npm run typecheck`, `npm test`, `npm run test:db` and `npm run build` once `npm install` can reach the registry from wherever this is deployed — it couldn't from this session's sandbox, so changes here are verified structurally (standalone byte-level checks of the PDF writer, including image embedding) and via the existing domain test suite, but not through the project's full pipeline. `tests/pdf-writer.test.ts` and `tests/db/*.test.ts` need real `node_modules` and only run in CI for the same reason.
