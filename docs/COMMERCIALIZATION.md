# KidHub: Commercialization Plan

**From working prototype to a product that centers switch to from Brightwheel, Tadpoles and WatchMeGrow.**

| | |
|---|---|
| Status of the product today | Working web prototype, piloting at one school group (see [README](../README.md)) |
| Audience | Founders, first hires, advisors, investors |
| How to use this document | Work through the phases in order. Each phase has an exit checklist; don't start selling the next phase's promises until its checklist is green. |

> **A note on facts and figures.** Competitor features, prices and contract terms change often and differ by customer. Everything in this document about competitors is written as *a hypothesis to verify* through customer interviews and current public materials before it goes into any sales material. Cost and effort figures are planning estimates, not quotes. Legal and compliance items need review by a qualified attorney in the states you operate in.

---

## Contents

1. [Where we are today](#1-where-we-are-today)
2. [The opportunity and positioning](#2-the-opportunity-and-positioning)
3. [Phased roadmap at a glance](#3-phased-roadmap-at-a-glance)
4. [Phase 0: Validate (weeks 0–6)](#4-phase-0-validate-weeks-06)
5. [Phase 1: Harden the foundation (months 1–3)](#5-phase-1-harden-the-foundation-months-13)
6. [Phase 2: High-fidelity product (months 3–8)](#6-phase-2-high-fidelity-product-months-38)
7. [Phase 3: Switching program (months 6–9)](#7-phase-3-switching-program-months-69)
8. [Phase 4: Launch and scale (months 9–18)](#8-phase-4-launch-and-scale-months-918)
9. [Security](#9-security)
10. [Privacy and compliance](#10-privacy-and-compliance)
11. [Scale and performance](#11-scale-and-performance)
12. [Reliability and operations](#12-reliability-and-operations)
13. [Business, pricing and go-to-market](#13-business-pricing-and-go-to-market)
14. [Team, budget and timeline](#14-team-budget-and-timeline)
15. [Risks and mitigations](#15-risks-and-mitigations)
16. [Master launch checklist](#16-master-launch-checklist)

---

## 1. Where we are today

### What works (verified)
- Next.js 15 web app on Vercel + Supabase (Postgres, auth, storage, realtime).
- Roles: owner (multi-site), director, teacher, parent, video-only family.
- Attendance with approved-pickup validation; multi-child care log; care timers; auto-built daily reports; milestones/portfolio; enrollment and waitlist; medical/allergy info.
- Staff clock-in with per-room ratio checks; certifications; timesheet CSV.
- Recurring and split billing with a daily cron; manual payment recording; year-end statements.
- Realtime messaging; announcements; photo approval; camera viewing windows with per-family approval.
- Rule-based alerts across schools; an AI Q&A assistant (Claude) for admins.
- Row-level security (RLS) in Postgres with 15 automated policy tests; 13 domain unit tests; an end-to-end walkthrough of all roles against Postgres 16 + PostgREST.

### What a paying customer would notice is missing
| Gap | Why it matters to a switching customer |
|---|---|
| Native iOS/Android apps | Parents and teachers expect App Store apps with push notifications. All three incumbents ship native apps (verify current state). |
| Online payments (card/ACH, autopay) | Billing is usually the deciding feature for a director. Without autopay we can't replace Brightwheel/Tadpoles billing. |
| Push, email and SMS notifications | "I didn't get the message" is the top support complaint in this category. |
| Offline mode for teachers | Classrooms often have weak Wi‑Fi. |
| Data import from the three apps | Nobody re-types 80 children, families and billing plans. |
| Real camera integration | Today we play any HLS URL; customers need a supported camera path and a vendor who will install it. |
| Subsidy/state reporting, lesson plans, payroll sync | Expected by a meaningful share of centers (verify which, by state). |
| Enterprise security posture (MFA, audit log, SOC 2) | Multi-site operators and their insurers will ask. |

### Known technical gaps in the current code (must fix before real customer data)
These come from a review of this repository. Each is covered in detail in §9.

1. **Invite sign-up doesn't verify email ownership.** `joinWithNewAccount` creates users with `email_confirm: true`. For invites without a locked email, a person could register under someone else's email address.
2. **No application-level rate limiting** on login, invite join, owner sign-up or demo setup. All sign-ins come from Vercel's server IPs, so Supabase's per-IP auth limits don't protect individual accounts.
3. **Owner sign-up is protected only by a shared code** (`OWNER_SIGNUP_CODE`).
4. **Camera stream URLs are long-lived.** `my_video_feeds()` returns the raw `stream_url` to approved families. Anyone they share it with can watch outside the allowed window.
5. **Signed photo URLs last 1 hour** and can be forwarded during that time.
6. **No audit log** of who viewed or changed what, e.g. who checked a child out, who approved video, who changed a pickup list.
7. **No MFA**, and no session controls for staff such as shared classroom tablets or idle timeouts.
8. **No security headers** (Content-Security-Policy, HSTS, frame-ancestors).
9. **Demo mode must be off in production.** The demo setup page deletes and recreates demo accounts. It's gated by the sign-up code, but it shouldn't exist in production builds at all.
10. **RLS helper functions run per row.** That's fine at pilot scale, but slow at thousands of children (see §11).
11. **The Supabase free tier pauses inactive projects** and has no point-in-time recovery. That's unsuitable for production data.

---

## 2. The opportunity and positioning

### The customer's problem (from the product doc)
- Centers often run two or three tools: an operations/billing app (Brightwheel **or** Tadpoles) plus a live-video product (WatchMeGrow).
- Results: duplicate data entry, two or three parent logins, separate bills, and no single view of safety and operations.
- AI features, where they exist, see only one product's data.

### Positioning statement (draft)
> For childcare centers and multi-site operators who juggle separate apps for operations, billing and classroom video, **KidHub** is the one platform where every check-in, care entry, payment and camera works together, so teachers enter things once, parents have one app, and directors see every school and every risk in one place. Unlike running Brightwheel or Tadpoles alongside WatchMeGrow, KidHub ties video permissions, safety alerts and AI to the same records.

### Why someone switches (hypotheses to test in Phase 0)
| Current setup | Likely pain | Our wedge |
|---|---|---|
| Brightwheel + WatchMeGrow | Two vendors, two parent apps, video not linked to attendance | One app; video only for checked-in kids' rooms; one bill |
| Tadpoles + WatchMeGrow | Same as above | Same |
| Brightwheel alone | Wants live video but doesn't want another vendor | Video built in, per-room and per-time permissions |
| WatchMeGrow alone + paper/spreadsheets | No operations software | Full operations + the video they already trust |
| Multi-site operator on any of the above | No cross-site dashboard; inconsistent data | Owner view across schools; cross-school alerts and AI |

### Differentiators to build and prove
1. **One record, everywhere.** A care entry updates the report, the timers and the alerts; a check-in decides which cameras a family can see.
2. **Safety intelligence across domains.** Ratios, missed check-outs, expired certifications and overdue care are already live. Video-based signals come later and carefully (§6.7).
3. **Multi-site first.** Owner dashboards and cross-school reporting from day one.
4. **Privacy you can explain.** Video access enforced in the database, center approval for every viewer, AI that only answers and flags.
5. **Painless switching.** Done-for-you migration, side-by-side running, and contract buy-out support (§7).

---

## 3. Phased roadmap at a glance

| Phase | When (estimate) | Goal | Exit criteria |
|---|---|---|---|
| **0. Validate** | Weeks 0–6 | Prove that people will switch and pay | 15+ discovery interviews; 3 signed design partners; pricing tested |
| **1. Harden** | Months 1–3 | Safe to hold real families' data | All §9 "Phase 1" security items done; paid infrastructure; backups tested; legal docs live |
| **2. High fidelity** | Months 3–8 | Feature parity on what decides purchases | Native apps in stores; autopay; notifications; offline; supported cameras; imports |
| **3. Switching program** | Months 6–9 | Make leaving an incumbent easy | Importers for all three apps; migration playbook; 10 paying centers migrated |
| **4. Launch & scale** | Months 9–18 | Repeatable sales and support | SOC 2 Type II underway or done; 100+ centers; churn < 2%/month |

Phases overlap. Phase 3 work starts as soon as the Phase 2 data model is stable.

---

## 4. Phase 0: Validate (weeks 0–6)

### 4.1 Customer discovery
- [ ] Interview **at least 15 directors/owners**: 5 on Brightwheel, 5 on Tadpoles, 5 using WatchMeGrow, plus as many multi-site operators as you can reach.
- [ ] Interview **10 parents and 10 teachers** (teachers decide whether a pilot survives).
- [ ] For each interview, capture: current tools and what they pay (ask for an invoice if they're willing), contract end dates, what they'd lose by switching, the top 3 frustrations, and who signs the contract.
- [ ] Map the decision process: who chooses, who can veto (often lead teachers or the parent community), and when budgets are set.
- [ ] Record the **exact features that would block a switch**. These become the Phase 2 must-haves.

### 4.2 Competitive teardown (verify, don't assume)
- [ ] Sign up for free trials or demos of each incumbent where possible. Document onboarding, billing setup, parent app, video permissions and data export.
- [ ] Collect **current public pricing** and typical contract terms from customers.
- [ ] Document **what data each incumbent lets a center export** (format, completeness, photos). This decides how importers are built (§7).
- [ ] Read app store reviews for all three apps and tag recurring complaints. These become marketing angles.

### 4.3 Design partners
- [ ] Sign **3 design partners** (your friend's group plus 2 others, ideally one per incumbent). Offer free or discounted use for 6–12 months in exchange for weekly feedback, a testimonial and a case study.
- [ ] Use a simple written agreement covering data handling, the right to stop at any time, and the discount.

### 4.4 Name, brand and entity
- [ ] **Check the name.** "KidHub" is a working name. Run trademark searches (USPTO TESS and state registers), domain availability and app store name collisions *before* investing in the brand. Budget for a trademark attorney.
- [ ] Form a legal entity (typically an LLC or C-corp; a C-corp if you plan to raise venture money). Open a business bank account.
- [ ] Get cyber liability and errors & omissions insurance quotes. Childcare customers and their insurers may require certificates.

**Exit checklist:** interviews written up; a top-10 must-have list ranked by how often it blocks a switch; 3 design partner agreements signed; name cleared or replaced.

---

## 5. Phase 1: Harden the foundation (months 1–3)

Do this **before any center other than the pilot enters real data.**

### 5.1 Infrastructure
- [ ] Upgrade **Supabase to a paid plan** for no project pausing, daily backups and point-in-time recovery. Use **separate projects for dev, staging and production**.
- [ ] Upgrade **Vercel to a paid plan** for commercial use, team access and higher function limits. Pin the Vercel function region next to the Supabase region.
- [ ] Move secrets into Vercel's encrypted environment variables per environment. Rotate every key that has been shared during the pilot.
- [ ] Turn **demo mode off in production**, and exclude `/demo/setup` from production builds (see §9.3).
- [ ] Set up a custom domain with HTTPS and HSTS.
- [ ] Add CI on GitHub Actions: typecheck, `npm test`, `npm run test:db`, build. Require it to pass before merging, and protect the `main` branch.
- [ ] Use migrations as the only way to change the database (Supabase CLI). Never edit production in the SQL editor.

### 5.2 Fix the known security gaps (details in §9)
- [ ] Email verification on every account creation.
- [ ] Rate limiting on authentication and invitation endpoints.
- [ ] Replace `OWNER_SIGNUP_CODE` with a controlled onboarding flow.
- [ ] Short-lived, tokenized video URLs.
- [ ] Audit log.
- [ ] MFA for owners and directors.
- [ ] Security headers.
- [ ] Password reset through a transactional email provider.

### 5.3 Legal foundation (attorney review required)
- [ ] Terms of Service, Privacy Policy, and a **Data Processing Agreement (DPA)** for centers.
- [ ] A **sub-processor list** (Supabase, Vercel, Anthropic, email/SMS provider, payment processor, video provider) published on your site.
- [ ] A Master Subscription Agreement template for multi-site operators.
- [ ] A camera/video addendum: consent, signage, retention, center responsibilities.
- [ ] Parent-facing privacy notice text that centers can send to families.

### 5.4 Observability
- [ ] Error tracking (e.g. Sentry) on server and client, with personal data scrubbed.
- [ ] Uptime monitoring and a public status page.
- [ ] Structured logs with request IDs. No children's data in logs.

**Exit checklist:** every Phase 1 item in §9 done; a backup restore tested end to end; legal docs published; staging environment in use.

---

## 6. Phase 2: High-fidelity product (months 3–8)

Rank the work by the Phase 0 blocker list. The order below is the expected ranking.

### 6.1 Native mobile apps (parents and teachers)
- **Approach:** React Native with Expo shares TypeScript, types and domain logic (`src/lib/domain`) with the web app. Keep the web app for directors and owners.
- **Parent app:** daily report feed, photos/videos, messages, billing with autopay, live video, pickup list, check-in/out by QR or kiosk PIN.
- **Teacher app:** roster, attendance, one-tap multi-child logging, timers, camera for photos/video, offline queue (§6.4).
- **Kiosk mode:** a front-door tablet for parent check-in with PIN or QR, where the pickup check happens.
- [ ] Apple Developer and Google Play accounts in the company's name. Complete each store's privacy and data-safety forms accurately.
- [ ] Apps that serve families with children usually get extra store review scrutiny. Expect review cycles, and plan releases with buffer time.
- [ ] Accessibility: VoiceOver/TalkBack, dynamic type, WCAG 2.2 AA contrast on web.
- [ ] Localization: Spanish at launch is a strong expectation in many US markets (verify per region).

### 6.2 Payments and billing (often the deciding feature)
- **Processor:** Stripe Connect (or similar) so each center gets paid directly; the platform can take a fee.
- [ ] Card and ACH; **autopay**; saved payment methods; split payers (already modeled as `billing_plans.split`).
- [ ] Late fees, discounts (sibling, staff), credits, refunds, partial payments, deposits and registration fees.
- [ ] Subsidy and third-party payer support: the family pays part, an agency pays part. Track agency balances separately.
- [ ] Payouts, reconciliation, financial dashboards, QuickBooks/Xero export.
- [ ] Use processor-hosted payment fields so card data never touches our servers (keeps PCI scope minimal, §10.6).
- [ ] Dunning: automated reminders already exist as alerts; add email/SMS/push reminders with the center's tone.
- [ ] Year-end statements with the provider's tax ID (the current statement page is the starting point).

### 6.3 Notifications
- [ ] Push (APNs/FCM via Expo), email (Postmark, Resend or SES) and SMS (Twilio or similar).
- [ ] Per-user preferences and quiet hours; emergency announcements override them.
- [ ] Delivery tracking ("read by 42 of 60 families") for closures and emergencies.
- [ ] SMS needs registration with carriers for business messaging (A2P 10DLC in the US) and opt-in/opt-out handling. Start this early, because approval takes time.

### 6.4 Offline mode for teachers
- [ ] A local queue in the mobile app (SQLite) for check-ins, care entries and photos, with retry and conflict rules.
  - Attendance: first write wins; a later conflicting write is flagged for the director.
  - Care entries: append-only, so there are no conflicts.
- [ ] A clear "3 entries waiting to sync" indicator. Never silently drop data.

### 6.5 Classroom operations parity
- [ ] Lesson planning and curriculum mapping to state early-learning standards, with a library to start from.
- [ ] Developmental assessments and portfolios exportable as PDF for parent conferences.
- [ ] Incident/accident reports with parent signature (e-sign), and medication logs with dual sign-off.
- [ ] Immunization and document tracking with expiry alerts (pattern already in certifications).
- [ ] Staff scheduling (planned vs actual vs ratio), and payroll export to Gusto and ADP.
- [ ] Enrollment: online application forms, waitlist ranking, tours, e-signature on enrollment packets, deposits.
- [ ] State licensing and subsidy reports. Start with the states your first customers are in.

### 6.6 Live video, production grade
- **Architecture:** cameras send RTSP to a media gateway, which publishes HLS or LL-HLS (or WebRTC) to a CDN, which serves our players through **signed short-lived URLs**.
  - Options: a managed video platform (e.g. Mux, Cloudflare Stream, AWS IVS), or self-hosted gateways (e.g. MediaMTX) at each center feeding a CDN. Evaluate cost per camera-hour and latency.
- [ ] A certified camera list and an **installer partner network**. WatchMeGrow customers already have cameras, so test re-using their hardware during migration.
- [ ] Tokenized URLs that expire with the viewing window (fixes gap #4). Watermark streams with a viewer ID to discourage re-recording.
- [ ] Concurrent viewer limits and adaptive bitrate for bandwidth balancing.
- [ ] Optional recording with a configurable retention period (default off; §10.4).
- [ ] A viewer audit trail: who watched which camera, and when.

### 6.7 AI layer (carefully)
Already live: rule-based alerts and the admin Q&A assistant.
- [ ] Expand Q&A to more data (with caching, §11.6), and log every question and answer for review.
- [ ] Proactive weekly digests for owners: risks, collections and staffing.
- [ ] **Churn-risk indicators** from engagement signals (report views, message response times, late payments). Show the reasons; never auto-act.
- [ ] Draft parent communications (daily notes, newsletters) for teacher review. Teachers edit and send; the AI never sends.
- [ ] **Computer vision** (automated observations, "child alone" detection, moment clips) is high risk. Defer it until legal review, explicit parent opt-in, and a privacy impact assessment are done. Never use face recognition without specific legal sign-off, because biometric privacy laws in several states (e.g. Illinois' BIPA) carry heavy statutory damages. See §10.5.
- [ ] Keep the guardrail: **AI answers and flags; people decide.** Write this into marketing and contracts.

### 6.8 Design quality ("high fidelity")
- [ ] Hire a product designer (contract is fine) to build a design system, a mobile-first parent experience, and onboarding flows.
- [ ] Run usability tests with 5 teachers and 5 parents per major flow before release.
- [ ] Measure: time to log a diaper for 4 infants (target under 10 seconds), time for a director to set up a new center (target under 1 hour with import).

**Exit checklist:** apps live in both stores; autopay processing real payments at design partners; notifications with delivery tracking; offline queue tested in a no-Wi‑Fi classroom; at least one supported camera path installed at a real center.

---

## 7. Phase 3: Switching program (months 6–9)

Switching cost is the main barrier. Remove it.

### 7.1 Importers
- [ ] A **CSV import wizard** with column mapping and preview, for children, families/guardians, pickups, classrooms, staff and billing plans. This is the universal fallback.
- [ ] **Incumbent-specific importers** built from the export formats documented in Phase 0 (§4.2). Use only exports the center is entitled to; don't scrape.
- [ ] Photo and history import where the incumbent export allows it. Otherwise give families a way to keep their old memories (e.g. a downloadable archive before cut-over).
- [ ] A **dry-run mode**: show "we'll create 84 children, 140 guardians, 12 rooms; 3 rows need attention" before committing.

### 7.2 Migration playbook (done with the center)
1. **Kickoff:** pick a cut-over date before the incumbent's renewal; collect exports.
2. **Import** into a staging copy; the director reviews it.
3. **Staff training** (30–45 minutes) and teacher devices set up.
4. **Family invitations** sent in bulk (email/SMS) with a short "why we're switching" letter the center can edit.
5. **Two weeks side by side:** attendance in both systems; billing still on the old system.
6. **Billing cut-over** at the start of a billing period: new autopay enrollments, then old autopay cancelled.
7. **Video cut-over:** repoint cameras, approve families in bulk, then cancel the old video service.
8. **30-day check-in;** collect a case study.

### 7.3 Commercial switching incentives (choose and test)
- Free migration and onboarding ("white-glove").
- **Contract overlap credit:** free months to cover the remaining term of an incumbent contract (cap and verify with proof).
- A bundle price lower than paying for operations + video separately (validate in Phase 0).
- A first-year price lock, and a month-to-month option for small centers.
- A 60-day satisfaction guarantee with full data export if they leave. Data portability is a selling point.

### 7.4 Sales collateral
- [ ] A comparison page per incumbent, accurate and dated, with a disclaimer that features change; legal review before publishing.
- [ ] A switching calculator: current spend on 2–3 tools vs KidHub, plus estimated admin hours saved.
- [ ] Case studies from design partners, with numbers (admin time saved, on-time payment rate, parent engagement).
- [ ] A security and privacy one-pager plus a full security overview for procurement (§9, §10).

**Exit checklist:** 10 paying centers migrated, at least 2 from each incumbent; a median migration under 2 weeks; zero data-loss incidents.

---

## 8. Phase 4: Launch and scale (months 9–18)

- [ ] Self-serve sign-up with a free trial (replacing the sign-up code), plus sales-assisted onboarding for multi-site operators.
- [ ] Support: a help center, in-app chat, phone support during center hours (often 6am–7pm local), and an incident hotline for safety-critical problems such as check-in down at 7:30am.
- [ ] Customer success: onboarding manager per new center; quarterly business reviews for multi-site accounts.
- [ ] Partnerships: early-education associations, licensing consultants, camera installers, franchise systems.
- [ ] SOC 2 Type I, then Type II (§10.7).
- [ ] Load testing to the targets in §11 before each major sales push.

---

## 9. Security

### 9.1 Threat model (who and what we defend against)
| Asset | Threats | Most important controls |
|---|---|---|
| Children's records (names, ages, allergies, medical, photos) | Account takeover, insider misuse, misconfigured access, data breach | RLS (exists), MFA, audit log, least privilege, encryption, monitoring |
| Live video | URL sharing, unauthorized viewers, stalking/custody disputes | Center approval (exists), time windows (exists), short-lived signed URLs, watermarking, viewer audit |
| Pickup authorization | Social engineering, a non-custodial parent added by someone else | Director-only changes or dual approval for pickup lists, audit log, notify both guardians of changes |
| Payments | Card fraud, bank account takeover | Hosted payment fields, processor fraud tools, confirmations on payout changes |
| Admin accounts | Phishing, password reuse | MFA, SSO for large operators, session limits |
| Platform | Leaked service key, dependency compromise | Secret management, key rotation, dependency scanning, least-privileged keys |

**Custody issues are a real risk in this market.** Build the workflows for them: court-order flags on a child record, restricted guardians, and immediate revocation of video and pickup rights, all with an audit trail.

### 9.2 Phase 1 fixes (from the code review, §1)
| # | Gap | Fix |
|---|---|---|
| 1 | Invite sign-up doesn't verify email | Send a verification email or one-time code before activating the account. Always require it when the invite isn't email-locked. Use a transactional email provider configured as Supabase's SMTP. |
| 2 | No rate limiting | Per-account and per-IP limits on login, join, sign-up and password reset, using the client IP from `x-forwarded-for` on Vercel with an Upstash Redis-style store. Lock out after N failures with exponential backoff. Add a CAPTCHA after failures. |
| 3 | Shared sign-up code | Self-serve sign-up with email verification and a trial, or sales-provisioned organizations. Remove `OWNER_SIGNUP_CODE`. |
| 4 | Long-lived video URLs | Never return the origin `stream_url` to families. A server endpoint checks `my_video_feeds()` and returns a CDN-signed URL that expires at the end of the window, at most 15 minutes, refreshed while the window is open. |
| 5 | Photo links last 1 hour | Shorten to 5–10 minutes for in-app viewing. Use a separate download flow that records each download. |
| 6 | No audit log | An append-only `audit_events` table written by database triggers on sensitive tables (attendance, pickups, guardians, video approvals, invoices, roles), recording actor, time, before/after and IP. Owners can read it in the UI. |
| 7 | No MFA | TOTP MFA via Supabase Auth, mandatory for owners and directors and optional for staff and parents. Short sessions and a PIN switch-user mode on shared classroom tablets. |
| 8 | No security headers | Content-Security-Policy (allow-listed origins for Supabase, the video CDN and the payment processor), HSTS, `frame-ancestors 'none'`, Referrer-Policy and Permissions-Policy in `next.config.mjs` or middleware. |
| 9 | Demo code in production | Build-time flag: the `/demo` routes and seed module aren't included in production. Run the demo on a separate deployment and database. |

### 9.3 Application security practices
- **Keep authorization in the database (RLS) as the source of truth.** Every new table needs RLS and policy tests in `tests/db/rls.test.ts` before merge. Add a CI check that fails if any public table has RLS disabled.
- **Service-role key:** use it only in the few server paths that need it (account creation, cron). Wrap those in a reviewed module and never import it into client code. Consider moving these paths to Supabase Edge Functions with narrowly scoped logic.
- **Input validation:** a schema validator (e.g. Zod) on every server action, with length limits on all text. The database already has checks on message length.
- **File uploads:** check type by magic bytes, not the file name; size limits (already 7 MB); strip EXIF and GPS location from photos before storage; consider re-encoding images. Serve SVG only from trusted sources: the demo uses SVG, but don't allow SVG uploads from users.
- **Dependencies:** Dependabot or Renovate, `npm audit` in CI, lockfile committed (it is). Keep Next.js and React on patched versions; Next.js 15 → 16 is planned to clear the PostCSS advisory noted in the README.
- **Secrets:** never in git; a rotation schedule; separate keys per environment; restrict who can view production secrets in Vercel and Supabase.
- **Admin access to customer data:** support staff use just-in-time, logged "view as" access approved by the customer. No standing access.

### 9.4 Testing and assurance
- [ ] Threat-model review for each major feature (video, payments, AI).
- [ ] Automated security tests: RLS policy tests (exist), authorization tests for every server action, dependency scanning, secret scanning.
- [ ] An **independent penetration test** before general availability, then yearly and after major changes. Include the mobile apps and video delivery.
- [ ] A vulnerability disclosure policy (`/.well-known/security.txt`) and later a bug bounty.

### 9.5 Incident response
- [ ] A written incident response plan: severity levels, on-call rotation, communication templates for centers and families, evidence preservation.
- [ ] **Breach notification:** US state laws and many customer contracts set notification duties and deadlines. Get counsel to build a matrix by state and contract, and rehearse it with a tabletop exercise twice a year.
- [ ] A kill switch for video (all cameras off, platform-wide or per center) and for AI features.

---

## 10. Privacy and compliance

> Work with an attorney experienced in edtech/childcare privacy. The items below are what to *ask about*, not legal conclusions.

### 10.1 Principles
- **The center owns its data; we process it on their behalf.** Write this into the DPA. No selling data, no advertising, no using children's data to train AI models.
- **Data minimization:** collect only what a feature needs. Medical notes are free text today; consider structured fields with clear purposes.
- **Transparency:** a plain-language privacy center for parents; centers can show families exactly who can see what.
- **Portability:** a full export (CSV + media archive) for centers at any time, and a parent export of their own child's records.

### 10.2 Laws and frameworks to evaluate (US-focused; confirm applicability)
| Area | Why it may apply | Questions for counsel |
|---|---|---|
| **COPPA** (Children's Online Privacy Protection Act) | The service handles personal information about children under 13, and some features (photos, video) involve children directly | Do we rely on the center's authorization? Do the 2025 rule amendments change anything for us? What are the retention requirements? |
| **FERPA** | Some customers (public pre-K, Head Start, school-district programs) may hold education records subject to FERPA | Do we need "school official" contract terms for those customers? |
| **State student/child privacy laws** (e.g. California's SOPIPA) | Many states regulate operators of services used for K‑12 and sometimes pre-K | Which states are our launch markets, and do their laws reach early childhood? |
| **State consumer privacy laws** (e.g. CCPA/CPRA and similar laws in other states) | Parents and staff are consumers; children's data is often treated as sensitive | Service-provider contract terms, handling of data-subject requests, sensitive data rules |
| **Biometric privacy laws** (e.g. Illinois BIPA, Texas, Washington) | Any face recognition or face geometry from video | Avoid entirely unless counsel approves a compliant program |
| **Childcare licensing rules** (per state) | Required records (attendance, incidents, medication, immunizations), retention periods, camera rules in some states | Retention periods by record type; whether digital sign-in satisfies state requirements |
| **Video and recording laws** | Audio recording consent laws differ by state; employee notice for workplace video | Should we disable audio by default? What signage and notices are needed? |
| **CAN-SPAM / TCPA** | Email and SMS to parents | Opt-in and opt-out handling, especially for SMS |
| **Accessibility** (ADA and similar) | Parents and staff with disabilities | Target WCAG 2.2 AA |
| **International** (only if expanding) | GDPR/UK GDPR, Canadian privacy law | Data residency, lawful basis, representative requirements |

### 10.3 Consent and permissions model
- Per-family consent records for photo sharing, video viewing, marketing use of photos (default **no**), and AI features that use their child's data.
- Per-child "do not photograph" and "restricted guardian" flags honored everywhere: photo logging, video and pickup.
- Staff consent and notice for classroom video; an employee-facing policy template for centers.

### 10.4 Data retention and deletion
| Data | Suggested default (confirm per state licensing rules) |
|---|---|
| Attendance, incidents, medication, immunization records | Retain for the period required by the center's licensing rules, then delete |
| Daily care entries and photos | While enrolled, plus a configurable period (e.g. 1 year); families can download before deletion |
| Messages | While enrolled, plus a configurable period |
| Live video | Not recorded by default. If recording is enabled, short default retention (e.g. 7–30 days) with automatic deletion |
| Billing records | As needed for tax and accounting (often years), with access limited to admins |
| Audit logs | At least 1 year; longer for enterprise plans |
| Backups | Rolling window (e.g. 30 days). Deletions propagate as backups age out; document this in the DPA |

- [ ] Automated retention jobs per table, with deletion logged.
- [ ] Off-boarding: when a center leaves, export → confirm → delete within a stated period, then issue a deletion certificate.
- [ ] Storage cleanup: delete orphaned media files (the demo removal today leaves storage objects behind).

### 10.5 AI-specific privacy
- Use AI providers under terms that **don't train on customer data**, and confirm data retention settings. Anthropic's commercial API terms and settings should be reviewed and documented in the sub-processor list.
- Send only the minimum context. The current assistant sends an admin's school snapshot; trim it to fields relevant to the question, and avoid medical notes unless they're needed.
- Log prompts and answers for safety review, with access controls and the same retention as audit logs.
- Publish an AI use statement: what AI does, what it never does (decide, act, contact families), and how to turn it off.
- **No biometric identification.** No face recognition or emotion detection on children without explicit legal clearance and opt-in.

### 10.6 Payments compliance
- With processor-hosted fields (e.g. Stripe Elements or Checkout), card data never touches our servers, which usually keeps PCI DSS scope to the lightest questionnaire (SAQ A). Confirm with the processor.
- Know-your-customer for centers is handled by the processor's Connect onboarding.
- Clear refund, dispute and chargeback workflows for directors.

### 10.7 Certifications and assurance
- **SOC 2 Type II** is the standard request from multi-site operators and larger customers. Use a compliance automation platform (e.g. Vanta, Drata or Secureframe) to collect evidence. Expect roughly 3–6 months to Type I readiness and a 3–12 month observation period for Type II (estimates).
- Consider the **Student Privacy Pledge** or similar commitments if serving public pre-K.
- Publish a trust page with security overview, sub-processors, status page, DPA and the latest pen test summary.

---

## 11. Scale and performance

### 11.1 Planning targets (adjust after Phase 0)
| Dimension | Year-1 target | Design ceiling (architect for) |
|---|---|---|
| Centers | 200 | 5,000 |
| Children per center | 80 avg, 300 max | 500 |
| Daily care entries per child | 10 | 30 |
| Peak load | 7:00–9:00am and 4:30–6:30pm local (check-in/out), across 4 US timezones | |
| Messages | 20 per center per day | |
| Concurrent video viewers | 10% of families during viewing windows | 25% |
| API latency (p95) | < 300 ms for reads, < 500 ms for writes | |
| Page load on 4G (parent app) | < 2 s to first meaningful content | |

Rough data volume at the design ceiling: 5,000 centers × 500 children × 30 entries/day comes to tens of millions of activity rows per day. That's a big Postgres, but a normal one with the right indexes and partitioning (below).

### 11.2 Database
- **Indexes to add** for the current query patterns:
  - `attendance (school_id, day)` and a partial index `attendance (school_id) where check_out_at is null`
  - `shifts (school_id) where clock_out_at is null`
  - `invoices (school_id, status, due_on)`, `invoices (child_id, status)`
  - `guardians (profile_id)` (used by every family request and many RLS checks), `children (school_id, status)`
  - `school_staff (profile_id)`, `pickups (child_id)`, `certifications (school_id, expires_on)`
- **RLS performance.** Helper functions like `is_staff(school_id)` run for every row checked. At scale:
  - Rewrite policies to compare against a set computed once per query, e.g. `school_id in (select my_staff_school_ids())`. Postgres can cache that result instead of calling a function per row.
  - Wrap `auth.uid()` calls as `(select auth.uid())` in policies (Supabase's documented optimization).
  - Optionally put the user's school memberships into JWT custom claims (via a Supabase auth hook) to avoid lookups, with short token lifetimes so revocations take effect quickly.
  - Benchmark every policy with `EXPLAIN ANALYZE` on production-sized test data, and keep a performance test in CI.
- **Partitioning:** partition `activities` and `messages` by month once they reach tens of millions of rows; archive old partitions to cheaper storage per the retention policy.
- **Connection pooling:** use Supabase's pooler for serverless functions; keep transactions short.
- **Read replicas** for reporting, the AI assistant context and analytics, so heavy queries don't slow check-ins.
- **Summary tables:** nightly or incremental rollups for dashboards (attendance per room per day, collections per month) instead of scanning raw tables.

### 11.3 Application
- **Dashboard queries:** `loadSnapshot` currently runs about 9 queries per request across all admin schools. Move it to one database function per request, cache the result for 30–60 seconds per user, and paginate alerts.
- **Pagination everywhere:** children lists, invoices (currently capped by date window), messages (capped at 200), activities history.
- **Realtime:** Supabase Realtime for messages works at pilot scale. At scale, use broadcast channels per thread with server-side authorization, and check the plan's concurrency limits.
- **Images:** resize on upload (thumbnail + display size), serve through a CDN with signed URLs, and lazy-load in feeds.
- **Edge and caching:** static assets are already cached by Vercel's CDN. Keep authenticated data uncached by shared caches.
- **Background jobs:** move billing runs, notification fan-out, imports and retention jobs to a queue (e.g. Inngest, Trigger.dev, or a Postgres-backed queue) with retries and idempotency. Billing is already idempotent through a unique index.

### 11.4 Video at scale
- Bandwidth estimate: a 720p stream is roughly 1.5–3 Mbps per viewer. 1,000 concurrent viewers is about 1.5–3 Gbps, which must come from a CDN, never our app servers.
- Each center's uplink is a common bottleneck. Send **one** stream per camera to the cloud, and let the CDN fan out to viewers.
- Adaptive bitrate (several renditions) and per-center viewer caps for "bandwidth balancing".
- Cost model: per camera-hour of ingest and transcode, plus per viewer-hour of delivery. Price video as an add-on per camera or per classroom so margins hold (§13).

### 11.5 Mobile performance
- Offline-first local store; sync deltas, not full lists.
- Background upload of photos and videos with retry; compress before upload.
- Target cold start under 2 seconds on mid-range Android devices.

### 11.6 AI cost and latency
- Cache the assistant's data snapshot per school for a few minutes, and use prompt caching for the stable instructions and context.
- Choose effort level and model per task: quick lookups at lower effort, weekly digests at higher effort, run as background jobs.
- Per-center monthly AI usage caps, with usage shown to admins.
- Track cost per center per month as a unit-economics line item.

### 11.7 Load and performance testing
- [ ] Generate production-sized synthetic data, extending the demo seed generator to N centers.
- [ ] Simulate the morning check-in rush (k6 or Artillery) across all timezones at the design target.
- [ ] Track p95 latency and error rates per endpoint; set budgets and fail CI on regressions for key queries.

---

## 12. Reliability and operations

### 12.1 Availability targets
- Check-in/out, the care log and messaging are **operationally critical** during center hours. Target 99.9% monthly availability for core flows (about 43 minutes of downtime a month); offer 99.95% in enterprise contracts once proven.
- Offline mode (§6.4) makes the teacher app tolerate outages; that's part of the reliability story.

### 12.2 Backups and disaster recovery
- Daily backups plus point-in-time recovery (paid Supabase). Media storage with versioning or replicated backups.
- **Test a restore quarterly** into a scratch project and record the time it took.
- Targets: recovery point objective of 15 minutes or less, recovery time objective of 4 hours or less. Document a runbook.
- A paper fallback kit for centers: printable daily roster with pickups and allergies, generated each morning and also sent to directors by email.

### 12.3 Monitoring and on-call
- Alerts for error rate, latency, failed cron runs (billing), failed notifications and video ingest drops.
- On-call rotation covering 6am–8pm in every customer timezone, with escalation.
- Post-incident reviews shared with affected customers.

### 12.4 Release management
- Staging environment with anonymized or synthetic data; preview deployments per pull request.
- Feature flags for risky features (video, payments, AI) and per-center rollouts.
- Database migrations must be backward compatible (expand → migrate → contract) to allow zero-downtime deploys.
- Release notes for centers; avoid releases during morning drop-off hours.

---

## 13. Business, pricing and go-to-market

### 13.1 Pricing model (hypotheses to test in Phase 0)
| Option | Pros | Cons |
|---|---|---|
| Per enrolled child per month | Scales with center size; familiar in the category (verify) | Small centers may find it expensive |
| Per center tiers (Core / Plus / Pro) | Simple to buy | Leaves money on the table with large centers |
| Video as a per-camera or per-classroom add-on | Matches our real costs | Adds complexity |
| Payment processing fee (platform margin on card/ACH) | Revenue grows with usage; can lower the subscription price | Directors are sensitive to fees passed to parents |

**Recommendation to test:** tiered per-child pricing for operations and billing, video as a per-classroom add-on, and payment processing at or below the processor's standard rates plus a small platform margin. Present it as **"less than you pay for your operations app + video app combined"**, a claim that must be verified against each prospect's actual invoices.

### 13.2 Unit economics to track
- Infrastructure cost per center per month: database, hosting, storage, video, AI, notifications (especially SMS).
- Gross margin target above 70% excluding payments pass-through (estimate; validate).
- Customer acquisition cost, payback period (target under 12 months), net revenue retention, logo churn.

### 13.3 Go-to-market
- **Beachhead:** multi-site operators (3–20 sites) already running 2+ tools. They feel the pain most and buy for several sites at once. Your friend's group is the reference customer.
- **Channels:** founder-led sales to design partners and their networks; state and regional childcare associations and conferences; franchise systems; camera installers who serve WatchMeGrow-type customers; content (switching guides, licensing compliance checklists); parent word of mouth through a referral program.
- **Sales motion:** demo (the demo environment already exists), then switching calculator, then free migration, then a 30-day side-by-side pilot, then contract.
- **Proof:** publish metrics from the product doc's success measures: admin hours saved, on-time payment rate, parent engagement, teacher satisfaction.

### 13.4 Customer support model
- Onboarding and migration specialists, the most important hires after engineering.
- Help center with short videos per role; in-app guided tours for first use.
- Response targets by severity (e.g. under 15 minutes for "can't check children in" during center hours).

---

## 14. Team, budget and timeline

### 14.1 Team (minimum to reach Phase 4)
| Role | When | Notes |
|---|---|---|
| Founder/CEO (sales, customers) | Now | Runs discovery and design partners |
| Senior full-stack engineer (web + Supabase) | Phase 1 | Security fixes, billing, imports |
| Mobile engineer (React Native) | Phase 2 | Parent/teacher apps, offline |
| Product designer (contract → full time) | Phase 2 | Design system, usability testing |
| Video/infrastructure engineer or vendor | Phase 2 | Camera ingest, CDN, signed URLs |
| Onboarding/customer success lead | Phase 3 | Migrations, training |
| Security/compliance (fractional) | Phase 1 onward | SOC 2, policies, pen test coordination |
| Attorney (outside counsel) | Phase 0 onward | Privacy, contracts, trademarks |

### 14.2 Budget categories (gather quotes; figures vary widely)
- **People** (the largest cost by far).
- **Infrastructure:** Supabase and Vercel paid plans, video platform (usage-based), email/SMS, error tracking, compliance platform.
- **Third-party assurance:** penetration test, SOC 2 audit fees.
- **Legal:** privacy documents, DPA, MSA, trademark, entity formation.
- **Insurance:** cyber liability, errors & omissions, general liability.
- **App stores:** developer program fees.
- **Go-to-market:** conferences, associations, collateral, demo hardware (a sample camera kit).

Build a 12–18 month financial model with these lines and update it monthly. Unit costs per center (§13.2) are the inputs that matter.

### 14.3 Indicative timeline
```
Month:      0   1   2   3   4   5   6   7   8   9  10  11  12 ... 18
Phase 0   ████
Phase 1     ████████████
Phase 2               ████████████████████
Phase 3                           ████████████
Phase 4                                       ███████████████████████
SOC 2                 ──── readiness ────┤ Type I ├─ Type II observation ─┤
Pen test                                ▲ (pre-GA)                    ▲ (annual)
```

---

## 15. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Centers won't switch mid-contract | High | High | Contract-overlap credits; target renewal dates; side-by-side pilots |
| Incumbents respond with bundles or discounts | Medium | Medium | Compete on multi-site and integrated safety, not only price; deep switching support |
| Security or privacy incident involving children's data | Low–Medium | Severe | Everything in §9–10; insurance; incident drills; a minimal-data design |
| Video legal exposure (state rules, custody disputes, recordings) | Medium | High | Center-controlled permissions (exist), no recording by default, legal templates, custody workflows, audit trail |
| Biometric/AI misuse claims | Low (if avoided) | Severe | No face recognition; opt-in; legal review before any computer vision |
| Payment problems (failed autopay, disputes) | Medium | High | Proven processor; dunning; clear reconciliation; responsive support |
| Video costs exceed revenue | Medium | Medium | Usage-based pricing for video; adaptive bitrate; viewer caps |
| Scaling issues during morning rush | Medium | High | Indexes, RLS optimization, load tests, offline-first apps |
| Key-person dependency (small team) | High | Medium | Documentation, runbooks, infrastructure as code, shared on-call |
| Name/trademark conflict | Unknown | Medium | Clear the name in Phase 0 before branding spend |

---

## 16. Master launch checklist

**Before any new center enters real data (end of Phase 1)**
- [ ] Paid Supabase (PITR) and Vercel; separate dev, staging and production; secrets rotated
- [ ] Demo mode off and excluded from production
- [ ] Email verification, rate limiting, MFA for admins, security headers
- [ ] Short-lived signed video and photo URLs
- [ ] Audit log on sensitive tables
- [ ] RLS tests in CI; every table checked
- [ ] Terms, Privacy Policy, DPA, sub-processor list published
- [ ] Error tracking, uptime monitoring, status page
- [ ] Backup restore tested
- [ ] Incident response plan and breach-notification matrix

**Before charging customers (end of Phase 2)**
- [ ] Native apps in both stores; push notifications
- [ ] Autopay and reconciliation working at design partners
- [ ] Offline teacher mode tested in a classroom
- [ ] At least one supported camera installation path
- [ ] Accessibility review (WCAG 2.2 AA) of core flows
- [ ] Insurance in place

**Before general availability (end of Phase 3)**
- [ ] Importers and migration playbook proven with 10 centers
- [ ] Independent penetration test done; critical and high findings fixed
- [ ] SOC 2 Type I report, or readiness assessment complete
- [ ] Load test at the design target passed
- [ ] Support coverage across all customer timezones during center hours
- [ ] Comparison pages and switching calculator reviewed by counsel

**Ongoing**
- [ ] Quarterly restore tests; yearly pen test; yearly policy review
- [ ] Monthly unit-economics review
- [ ] Customer advisory board (design partners) meeting quarterly

---

*This plan should be revisited after Phase 0 interviews. Customer evidence outranks anything written here.*
