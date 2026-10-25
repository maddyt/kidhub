# One-week pilot plan

A low-risk way to test KidHub at one classroom before rolling it out.

## Day 0: setup (director + you, ~1 hour)
- [ ] Deploy (README → "Try it in 15 minutes"). Keep `NEXT_PUBLIC_DEMO_MODE=true` and walk through the demo as each role together.
- [ ] Create the real organization at `/signup`, add **one classroom** and its children.
- [ ] Add each child's allergies, medical notes and approved pickups.
- [ ] Invite the classroom's teachers (Staff → Create invite link). Invite 3–5 volunteer parents (child page → Invite).
- [ ] Optional: connect one camera (Cameras) with a short viewing window, e.g. 10:00–11:00 weekdays.

## Days 1–5: run it alongside the current app
Teachers use KidHub for **check-in/out and the care log**. Keep the existing system running in parallel so nothing is lost.

Daily, 5 minutes:
- [ ] Director checks the Today page alerts. Are they useful, or noisy?
- [ ] At least one photo and one milestone per child.
- [ ] Parents check the daily report in the evening.

## Day 5: debrief questions
**Teachers**
- How long did logging take compared with today's app? Was multi-child logging used?
- Were the care timers right? (Adjust intervals in Settings.)
- Did pickup validation ever block the wrong person?

**Parents**
- Was the daily report accurate and on time? Were photos clear?
- Did messages get answered? Did video work on their phone?

**Director**
- Which alerts were actionable? Which should be quieter?
- What's missing before billing could move over? (Online payments are the planned next step.)

## Success signals from the product doc
- Admin time saved (target: 20+ hours/month per center)
- On-time payment rate (shown on Billing)
- Teacher satisfaction / less app-switching
- Families using reports, messages and video weekly

## Rolling back
Nothing in the pilot changes the existing system. To remove pilot data, an owner can delete children and classrooms in the app, or delete the Supabase project.
