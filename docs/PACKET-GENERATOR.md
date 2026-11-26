# Addendum: Packet Generator (extends F16 of PRD-MONTESSORI.md)

| | |
|---|---|
| **Status** | Built, including illustrated picture cards via fal.ai/FLUX (set `FAL_API_KEY` to enable) |
| **Replaces** | [PRD-MONTESSORI.md §7 F16](PRD-MONTESSORI.md#f16-printable-templates-and-exports) ("Printable templates and exports") with a real feature |
| **Origin** | Adapted from an external "Automated Montessori Fabrication Engine" PRD, fit to KidHub's existing schema, auth and AI integration instead of the Python/GCS/SIS stack it originally specified |

## 1. What it is

A teacher or a full guardian types a curiosity question — *"Parts of a honeybee"*, *"Why do leaves change color?"* — picks a developmental plane and subject area, and gets back a printable Montessori packet in a few seconds: an AI-drafted vocabulary set, a short "Cosmic Story Hook," and a hands-on Control of Error activity, compiled into a PDF with KidHub's Montessori color-coding.

It lives at **Packet Generator** in the staff nav and **Packet Generator** under My family, backed by `supabase/migrations/0003_packets.sql`.

The form also offers **Find existing PDFs**, independently of generation. Set the server-only
`BRAVE_SEARCH_API_KEY` to enable Brave Search. Searching sends the entered topic, subject and age
range to Brave, so do not enter personal information in the topic. No child ID or school data is
sent. Searches are limited to 30 per user per hour. Results are external PDF links, not stored,
downloaded or vetted by KidHub: availability, price, licensing, safety and age-appropriateness
must be checked by the adult. Search results can be incomplete, and generation still works if
search is unconfigured or unavailable.

## 2. Why fold it into KidHub rather than ship it standalone

The source PRD proposed a separate product: its own personas, its own FERPA/COPPA/SOC 2 compliance dashboard, SIS roster sync, a Python/LangChain backend, GCS storage and a GPU segmentation model (SAM2). That's enterprise scaffolding for a tool that itself states it needs zero student PII — and it would rebuild auth, tenancy and AI plumbing KidHub already has.

Instead: reuse `is_staff` / `is_full_guardian` RLS, the `media`-bucket storage pattern, the existing Anthropic SDK integration, and the Teacher/Director/Parent personas already in `src/app/(app)/`. The color-coding (`SUBJECT_COLOR` in `src/lib/domain/packets.ts`) deliberately mirrors the curriculum areas already named in PRD-MONTESSORI.md §3 (Practical Life, Sensorial, Language, Mathematics, Cultural) so a future `lesson_id` column can be added without renaming anything.

## 3. What ships today vs. later

| Source spec (Subsystem) | This build |
|---|---|
| A — Curriculum agent + fact-check gate | **Shipped.** `src/lib/ai/packets.ts`: Claude drafts the manifest against a strict shape (`src/lib/domain/packets.ts`), with one repair retry on a validation failure, plus a deny-list scan for grading/ranking/comparison language (reusing the rule already in PRD-MONTESSORI.md §8). |
| B — Illustrations + SAM2 segmentation + VLM judge | **Shipped**, minus SAM2. `src/lib/images/provider.ts` supports two providers, switched with `IMAGE_PROVIDER` so they can be compared without a code change: **fal.ai (FLUX Schnell)**, the default, and **Google Gemini (Nano Banana 2 / `gemini-3.1-flash-image`)**. Both are a single synchronous `fetch` call (no job polling, no SDK) — chosen over a GPU segmentation pipeline for the same reason SAM2 was dropped (see below). `judgeIllustration()` (`src/lib/ai/packets.ts`) reuses Claude's own vision input as the VLM judge rather than a separate API. `src/lib/packets/illustrations.ts` generates + judges up to `MAX_ILLUSTRATED_TERMS` (4) terms **in parallel**, 2 attempts each, and skips a term that fails every attempt, errors, or comes back in an image variant the PDF writer can't embed — the packet still compiles without it. Runs for free with no provider configured (`imageGenerationConfigured()` short-circuits). |
| C — ReportLab/WeasyPrint PDF compiler | **Shipped, rebuilt, now embeds images.** Python PDF libraries don't run on Vercel. `src/lib/pdf/packet-compiler.ts` renders the same card geometry (control/picture/label-strip/definition-card sizes, 0.25pt crop marks, duplex-mirrored backs) on top of a small hand-rolled PDF writer (`src/lib/pdf/pdf-writer.ts`) — added with no new npm dependency after `pdf-lib` turned out to be unreachable from this environment's network. `pdf-writer.ts` embeds **JPEG** (FLUX's output) as a DCTDecode Image XObject, parsing width/height from the JPEG's own SOF marker, and **PNG** (Gemini's output) by passing its IDAT bytes straight through as `/Filter /FlateDecode` with a PNG `/Predictor` — PDF's predictor scheme is PNG's own filtered/deflated layout, so a reader undoes both without this code ever decoding a pixel. Only 8-bit, non-interlaced, no-alpha PNGs are supported (plain illustrations on white, which is all this needs); anything else is rejected rather than mishandled. If this needs more than that, swap in a real PDF library instead of growing the hand-rolled one. |

A packet with an image provider configured gets, per illustrated term (up to 4): a picture card (the generated illustration + the term name), in addition to the existing label strips (Primary) or duplex definition cards (Elementary) and the Control of Error activity. Without one, it's exactly the text-only packet described above — `imageGenerationConfigured()` gates the picture cards and the UI's "no image provider configured" notice, and nothing else changes.

**Provider comparison, first real runs:** FLUX Schnell is fast but its instruction-following was weak even after a prompt rewrite (see `buildPrompt()` in `provider.ts`) — early runs saw embedded text labels with leader lines and off-white/mottled backgrounds where a pure `#FFFFFF` backdrop was required, both explicitly forbidden in the prompt. The VLM judge caught these correctly (that's its job), but the practical effect was a low accept rate (around 1 in 4–8 attempts in early testing) and most of the illustration budget spent on rejected images. Gemini (Nano Banana 2) was added specifically to compare instruction-following at similar speed; no comparable data yet. Re-check both once there's more usage, and reconsider the provider or add a third retry before raising `MAX_ILLUSTRATED_TERMS`.

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
4. Re-run `npm run typecheck`, `npm run test:db` and `npm run build` once `npm install` can reach the registry from wherever this is deployed — it couldn't from this session's sandbox. `npm test` (including `tests/pdf-writer.test.ts`) runs fine without `node_modules`; `pdf-writer.ts` deliberately has no `'server-only'` guard — see the comment there — specifically so this stays testable with plain `node --test`. `tests/db/*.test.ts` still needs real `node_modules` (PGlite) and only runs in CI.
