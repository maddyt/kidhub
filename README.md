# KidHub

One app for childcare centers that replaces three: the classroom operations and billing of Brightwheel / Tadpoles, and the live classroom video of WatchMeGrow, with one login, one source of truth, and alerts that look across all of it.

*KidHub is a working name. Change it in `src/app/layout.tsx` and `src/app/(app)/layout.tsx`.*

| Who | What they get |
|---|---|
| **Owner** (multi-site) | Every school on one dashboard, cross-school alerts, AI assistant, add campuses |
| **Director** | Enrollment & waitlist, billing, staff & certifications, approvals, cameras, announcements |
| **Teacher** | Check-in/out with approved-pickup validation, one-tap care log for several kids at once, care timers, photos, messaging |
| **Parent** | Today's report with photos, messages, invoices & year-end statements, live video, pickup list, invite grandparents |
| **Grandparent / deployed parent** | Live video only, after the school approves them |

**Log once, it flows everywhere.** A teacher logs one diaper change for three infants. That entry becomes each child's daily report line, resets their care timer, clears an overdue alert, and is something the AI assistant can answer questions about.

---

## Try it in 15 minutes

You need free accounts on **GitHub**, **Supabase** and **Vercel**.

### 1. Database (Supabase)
1. Create a project at [supabase.com](https://supabase.com) (free tier is fine). Pick a region near the schools.
2. Open **SQL Editor → New query**, paste the whole of [`supabase/migrations/0001_kidhub.sql`](supabase/migrations/0001_kidhub.sql), and click **Run**.
3. From **Project Settings → API**, copy the **Project URL**, the **anon public** key and the **service_role** key.

No email setup is needed. Accounts are created by invitation link, so Supabase never has to send mail.

### 2. Deploy (Vercel)
1. In Vercel, **Add New → Project → Import** this GitHub repo. The defaults are correct for Next.js.
2. Add **Environment Variables** (see [`.env.example`](.env.example)):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (server only) |
| `OWNER_SIGNUP_CODE` | any secret phrase; needed to create an organization at `/signup` |
| `CRON_SECRET` | any long random string (protects the daily billing job) |
| `NEXT_PUBLIC_DEMO_MODE` | `true` while trying it out, `false` for real use |
| `DEMO_PASSWORD` | password for the demo accounts |
| `ANTHROPIC_API_KEY` | optional; turns on the AI assistant |

3. **Deploy.** Vercel's daily cron (in `vercel.json`) issues recurring invoices each morning.

### 3. Load the demo (optional, recommended, no terminal needed)
Open `https://YOUR-APP.vercel.app/demo/setup`, enter your `OWNER_SIGNUP_CODE`, and click **Create / reset demo** (about 20 seconds). It needs `NEXT_PUBLIC_DEMO_MODE=true` and `DEMO_PASSWORD` set in Vercel.

The login page then shows one-click buttons for Owner, Director, Teacher, Parent and Grandparent at the fictional "Little Oaks Learning" (two campuses, 30 children, a realistic day with planted problems for the alerts to catch). The demo is dated the day you create it; click **Create / reset demo** again any time for a fresh day. **Remove demo** deletes it. It never touches real schools.

(Developers can do the same from a terminal with `npm run seed:demo`.)

### 4. Set up the real school
1. Go to `/signup`, enter the `OWNER_SIGNUP_CODE`, and create the organization and first campus.
2. **Settings:** add classrooms (ratio, capacity, diaper/bottle intervals). Add more campuses.
3. **Staff:** create invite links for directors and teachers. Send them by text or email.
4. **Children:** add each child, then on the child's page create an invitation link for each parent.
5. **Billing:** add tuition plans.

See [`docs/PILOT.md`](docs/PILOT.md) for a one-week pilot plan to run with the school.

See [`docs/COMMERCIALIZATION.md`](docs/COMMERCIALIZATION.md) for the plan to turn this into a commercial product: roadmap, switching program, security, privacy, scale and performance.

Run locally with `npm run dev` (uses `.env.local`).

---

## How privacy is enforced

Access rules live **in the database** (Postgres row-level security), not just in the UI, so a bug in a page can't leak another family's data.

- Parents see only their own children: reports, photos, messages, invoices.
- Video-only family members see live video and nothing else.
- Teachers see their school's classroom data but **not billing**.
- Directors see their school; owners see every school in their organization.
- **Families never receive camera URLs directly.** The `my_video_feeds()` database function returns a stream only when the viewer is center-approved, the camera is in their child's room (or a common area), and the current time, in the school's timezone, is inside a viewing window.
- Photos live in a private storage bucket. Families can open a photo only if it is their child's and has been approved.
- Invitation links are single-use, expire after 14 days, and can be locked to an email address.

These rules are covered by tests that run the real migration (`tests/db/rls.test.ts`).

**The AI assistant only answers and flags.** It sees a snapshot of data the signed-in admin can already see, and its instructions forbid it from making decisions. Alerts are deterministic rules (`src/lib/domain/alerts.ts`), so each one can say exactly why it fired.

---

## Live video

Families watch HLS streams (`.m3u8` over https) in the browser. Most IP cameras output RTSP, so a restreaming service sits in between. Options include a hosted service (e.g. Mux, Cloudflare Stream, Wowza), a camera vendor's cloud HLS output, or a small self-hosted gateway such as MediaMTX on a computer at the school. Paste the resulting HLS URL into **Cameras**. The demo uses public test streams.

Before turning video on for real, check your state's licensing rules on classroom cameras, and get parent and staff consent. Recording is not implemented.

---

## Development

```bash
npm test          # domain logic: timers, ratios, reports, billing math, alerts (no network)
npm run test:db   # row-level security against the real migration, in-process Postgres (PGlite)
npm run typecheck
npm run build
```

```
supabase/migrations/   Schema, RLS policies, RPCs, storage policies (one file)
src/lib/domain/        Pure logic: time zones, care timers, ratios, daily report, billing, alerts
src/lib/data/          Supabase queries (run as the signed-in user; RLS applies)
src/lib/ai/            AI assistant context + Claude API call
src/app/(app)/         Staff screens and /family/* parent screens
scripts/seed-demo.mts  Demo data
tests/                 Unit tests + database policy tests
```

Stack: Next.js 15 (App Router, server actions), Supabase (Postgres, auth, storage, realtime), Tailwind, hls.js, Anthropic SDK.

---

## Status and roadmap

**Built and tested:** attendance with pickup validation, care log and timers, daily reports, milestones/portfolio, enrollment and waitlist, medical/allergy info, staff clock-in with per-room ratios, timesheet CSV for payroll, certifications, recurring and split billing, year-end statements, announcements, realtime messaging, photo approval, camera schedules with family approval, multi-school owner view, alerts, and the AI assistant.

**Verified:** typecheck, production build, 13 unit tests, 15 database policy tests. **Not yet verified here:** a run against a live Supabase project. The first `seed:demo` against your project is the end-to-end check; please report anything that fails.

**Not in this version (from the product doc):**
- Online payments (Stripe card/ACH). Invoices are marked paid by the office for now.
- Email/SMS delivery of announcements (e.g. Resend / Twilio). Announcements are in-app only.
- Password reset by email (needs Supabase SMTP configured). For now an admin can issue a fresh invite.
- Offline mode, lesson planning, payroll provider sync (CSV export exists), recorded video, computer-vision observations, churn sentiment, and "child alone on camera" detection.

**Known advisory:** `npm audit` reports PostCSS advisories in the copy bundled inside Next.js 15. That copy only processes this app's own stylesheets at build time. They are fixed by moving to Next.js 16, a planned upgrade.
