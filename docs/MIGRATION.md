# Moving to KidHub from Brightwheel, Tadpoles and WatchMeGrow

**A practical plan for a school group switching from three apps to one, without disrupting families or staff.**

| | |
|---|---|
| Written for | The owner of the schools, plus whoever helps run the switch |
| What it covers | Moving children, families and billing data; onboarding parents and staff; moving live classroom cameras |
| What you'll need to decide | Marked with **🟡 Decision** throughout and collected in [§8](#8-decisions-and-questions-for-the-owner) |

> **Before relying on anything here:** what each vendor lets you export, and your contract terms with them, can change and can differ by account. Everything below about Brightwheel, Tadpoles and WatchMeGrow comes from their public help pages and should be confirmed in your own accounts and contracts. Sources are listed at the end.

---

## Contents

1. [The short version](#1-the-short-version)
2. [What moves, what doesn't](#2-what-moves-what-doesnt)
3. [Getting data out of each app](#3-getting-data-out-of-each-app)
4. [Getting data into KidHub](#4-getting-data-into-kidhub)
5. [Moving families and staff](#5-moving-families-and-staff)
6. [Moving billing](#6-moving-billing)
7. [Moving the live cameras](#7-moving-the-live-cameras)
8. [Decisions and questions for the owner](#8-decisions-and-questions-for-the-owner)
9. [Timeline and checklist](#9-timeline-and-checklist)
10. [Risks and how we avoid them](#10-risks-and-how-we-avoid-them)
11. [Sources](#11-sources)

---

## 1. The short version

- **Nothing is switched off until KidHub is proven.** We run KidHub alongside the current apps for about two weeks, and move one piece at a time: attendance and daily reports first, then billing, then cameras.
- **Children and family records come over from a spreadsheet export**, not by retyping. Brightwheel has a roster export. Tadpoles needs to be asked for one. WatchMeGrow holds no child records, so there's nothing to export.
- **Families join with one link.** Each parent gets an email invitation, creates a password, and sees their child. Grandparents and other relatives can be added later for video only.
- **Billing moves at the start of a month**, carrying over each family's current balance and tuition amount, not years of history.
- **The existing classroom cameras can most likely be reused.** A small device at each school sends the video to a cloud video service, and KidHub controls who can watch and when. One camera is tested first while WatchMeGrow keeps running.
- **Typical length:** about 6–10 weeks from "go" to cancelling the old apps. Most of that is the side-by-side period and timing around contract renewal dates.

---

## 2. What moves, what doesn't

| Information | Moves to KidHub? | How |
|---|---|---|
| Children (name, birthday, classroom, start date, enrollment status) | ✅ Yes | Roster export → import |
| Allergies and medical notes | ✅ Yes, if included in the export | Roster export (choose these fields), then spot-check every child with an allergy by hand |
| Parents and guardians (name, email, phone, relationship) | ✅ Yes | Roster/contacts export → invitations |
| Approved pickups and emergency contacts | ✅ Usually | Contacts export; otherwise the director or parents add them in KidHub |
| Classrooms and ratios | ✅ Set up once by hand | 10 minutes per school in **Settings** |
| Staff | ✅ Yes | Invite each staff member by email |
| Staff certifications (CPR, First Aid) | ✅ By hand | **Staff → Certifications** (a few minutes per person) |
| Waitlist | ✅ Yes, if exported | Roster export with "waitlist" status |
| Tuition amounts and payment schedules | ✅ Re-created | **Billing → Recurring plans**, one per child |
| Current balances owed | ✅ As one opening invoice per family | From the old app's billing report |
| Past invoices and payment history | ❌ Kept in the old app's reports | Download billing reports before cancelling, for tax and records |
| Past daily reports and messages | ❌ No | Families can save anything important before the switch |
| Photos and videos already shared | ❌ No | Give families 2–3 weeks to download from the old app |
| Families' saved card or bank details | ❌ Never transferable | Families re-enter them when online payments launch in KidHub (see [§6](#6-moving-billing)) |
| Camera hardware and wiring | ✅ Most likely reusable | See [§7](#7-moving-the-live-cameras) |
| Parents' video logins | ❌ Not needed | Parents use their KidHub login; the director approves video access |

---

## 3. Getting data out of each app

Do the exports in the **same week** as the import, so nothing changes in between.

### 3.1 Brightwheel

Brightwheel has two exports that together cover what we need:

1. **Student roster.** In Brightwheel, go to **My School → Students → Export Roster**. By default it includes active students; use the **Enrollment Status** filter to also include waitlisted students. **Choose fields:** names, birth date, classroom/room, enrollment status, start date, allergies/medical notes, and the contact fields.
2. **Parent contacts.** Go to **Reporting → Student Reports → Contacts**. Set **Student Status = Active** and **Type of contacts = Parents** (and separately, if available, authorized pickups and emergency contacts). Click **Create report**, then **Export**.

Both reports are **emailed** to you as CSV files, a spreadsheet format that Excel and Google Sheets open. Also download, for your records:

- [ ] The most recent **billing / balances report** (who owes what today)
- [ ] **Payment history** for the current tax year (for year-end statements)
- [ ] Attendance reports if your state licensing requires you to keep them for a period

### 3.2 Tadpoles

We couldn't find public documentation of a roster export for Tadpoles. **Ask Tadpoles support directly.** Suggested wording:

> *"We're reviewing our records and need an export of all enrolled and waitlisted children with their parent/guardian contacts, authorized pickups, emergency contacts and allergy information, in CSV or Excel format. Can you provide this, or show us where to download it?"*

If Tadpoles can't provide it, the fallback is a **spreadsheet template** (we'll provide one) that the director fills in from Tadpoles' screens. Expect about 1–2 minutes per child.

### 3.3 WatchMeGrow

There are no child records to move. Do ask WatchMeGrow, or check your contract, for:

- [ ] A **list of cameras** with their location (room), make and model
- [ ] **Who owns the equipment**: the cameras, the video server and the network switch
- [ ] **Administrator access to the cameras**: usernames and passwords, or whether WatchMeGrow manages them
- [ ] The **contract end or renewal date** and the cancellation notice period

More on why these matter in [§7](#7-moving-the-live-cameras).

### 3.4 Privacy when handling exports

These files contain children's personal and medical information.

- Keep them in one secure place (not personal email), share them only with the person doing the import, and **delete local copies once the import is checked**.
- Don't send real exports to developers for testing. **Column headers only** (the first row) or made-up rows are enough to set up the import.

---

## 4. Getting data into KidHub

### Today (works now, by hand)

- **Settings → Classrooms:** add each room with its ratio, capacity and (for infants/toddlers) diaper and bottle intervals.
- **Children → Add a child:** one form per child.
- **On each child's page:** add pickups and create an invitation for each parent.

Fine for a pilot classroom of 10–15 children; slow for a whole school.

### 🟡 Decision: Build item A, the spreadsheet import (recommended for more than ~30 children)

A screen where the director:

1. **Uploads** the CSV from Brightwheel, Tadpoles or the template.
2. **Matches columns** to KidHub fields (e.g. "Student First Name" → First name, "Room" → Classroom). Matches are remembered for the next school.
3. **Previews** the result: *"84 children, 140 parents, 12 pickups will be created. 3 rows need attention: missing birth date, unknown classroom 'Butterflies 2'."*
4. **Imports** with one click. Nothing is created until this step, and re-importing the same file doesn't create duplicates.

What makes it exact for this school group: the **column headers** of the actual Brightwheel export (and Tadpoles', if they provide one). Just the header row, no children's data.

Estimated build: a few days, including tests.

### Checking the import (director, about 1 hour per school)

- [ ] Child count per classroom matches the old app.
- [ ] **Every child with an allergy or medical note: open their page and check it word for word.** This is the one thing that must not be wrong.
- [ ] Each child has at least one parent with an email address.
- [ ] Pickup lists look right for a sample of 10 children.

---

## 5. Moving families and staff

### Staff (first)

1. Director or owner: **Staff → Create invite link** for each teacher, with their email.
2. Teachers open the link, set a password, and they're in. 30-minute training (we can provide a one-page guide).
3. Directors and the owner turn on **two-step verification** (an authenticator app on their phone) when they first sign in. KidHub requires it for anyone who can see every family's information.

### Families

1. Send a short **"we're switching" letter** first (template below), so the invitation email isn't a surprise.
2. Send each parent their invitation.
3. Parents open the link, set a password, and see their child's day. Video access starts once the director approves them (**Approvals** page).
4. Parents can invite **grandparents or a deployed parent** for video only, from **Pickups & family**.

### 🟡 Decision: Build item B, bulk email invitations (recommended)

Today each invitation link is copied and sent one at a time. Bulk invitations would:

- Send every parent at a school (or one classroom) their invitation **by email in one click**, using the school's name and a message the director can edit.
- Show who has joined and who hasn't, with a **"resend"** button.
- Also turn on **"Forgot password?" emails**, which need the same email setup.

**Needs:** a free or low-cost email-sending account (e.g. Resend or Postmark), connected once in Supabase and Vercel, and ideally a sender address on the school's own domain (e.g. `hello@yourschool.com`) so emails don't land in spam. Estimated build: 1–2 days.

### Template: letter to families (edit freely)

> **Subject: We're moving to one simple app for [School name]**
>
> Dear families,
>
> Starting [date], we're bringing daily reports, messages, billing and our classroom cameras together in one app called KidHub, replacing [Brightwheel/Tadpoles] and WatchMeGrow.
>
> **What you'll need to do:** watch for an email from [sender] with your personal invitation link. It takes two minutes to set up. Grandparents can be added for video once you're in.
>
> **What stays the same:** your child's teachers, classroom and schedule. For the first two weeks we'll keep using [current app] too, so nothing is missed.
>
> **Photos:** if you'd like to keep photos from [current app], please save them before [date + 3 weeks].
>
> **Questions?** Talk to [director] or reply to this email.
>
> Thank you,
> [Name]

---

## 6. Moving billing

Billing changes last, because families notice billing mistakes most.

1. **Pick a cut-over date at the start of a month**, e.g. the 1st.
2. In KidHub, create each child's **tuition plan** (amount, monthly or weekly, first bill date = the cut-over date). Each sibling gets their own plan; a plan can be split evenly between two parents (separate invoices for each).
3. Enter each family's **opening balance** as one invoice ("Balance carried over from [old app]") from the old app's balances report.
4. **Turn off recurring billing and autopay in the old app** for dates after the cut-over, so no family is charged twice.
5. Keep the old app's billing reports for tax and year-end statements for the months before the switch.

**🟡 Decision: how families pay.** KidHub currently **records** payments (cash, check, card, ACH, subsidy) but doesn't **take** online payments yet. Options:

- **(a)** Keep collecting through the old billing app until online payments are built in KidHub (simplest; delays cancelling that app).
- **(b)** Switch to direct payments (bank transfer, check, the school's existing card terminal) recorded in KidHub.
- **(c)** Prioritize building online payments and autopay in KidHub before the switch. This is the larger build, planned in [COMMERCIALIZATION.md §6.2](COMMERCIALIZATION.md#62-payments-and-billing-often-the-deciding-feature).

---

## 7. Moving the live cameras

### 7.1 How it works today (WatchMeGrow)

According to WatchMeGrow, each school has:

- **HD IP cameras** (indoor and outdoor), wired to
- a **PoE network switch** (one cable carries both power and video to each camera), and
- a **WatchMeGrow Secure Streaming Video Server** in a wall-mounted rack.

The server sends video to WatchMeGrow's apps, where families watch. Installation was done by a local partner. WatchMeGrow also works with some existing IP cameras after checking their make and model.

### 7.2 How it works in KidHub

```
 Classroom cameras ──► small "relay" device at the school ──► cloud video service ──► parents' phones
   (existing)            (sends each camera's video            (copies the video        (KidHub decides who
                          out once)                             to every viewer)          may watch, and when)
```

- **Cameras:** the existing IP cameras, which usually already send standard video (RTSP).
- **Relay device:** a small, inexpensive computer on the school network, running free relay software (e.g. MediaMTX). It sends **one copy** of each camera's video to the cloud, no matter how many parents watch.
- **Cloud video service:** a pay-as-you-go service such as **Mux** (or Cloudflare Stream or AWS IVS) that delivers video to any number of viewers.
- **KidHub:** decides access, meaning which family, which room, which hours, and director approval. It hands each viewer a link that **expires within 10 minutes**, and records every view in the audit log. Video is never recorded unless the school chooses to (not built yet).

### 7.3 What we need to find out first

| Question | Why it matters | Who can answer |
|---|---|---|
| Who owns the cameras, server and switch: the school or WatchMeGrow? | If the school owns them, we reuse them. If they're leased, they may have to be returned. | The WatchMeGrow contract / WatchMeGrow |
| Camera make and model, per room | Confirms they can send standard video to the relay | WatchMeGrow, the installer, or the label on each camera |
| Camera admin usernames and passwords | Needed to connect the relay. WatchMeGrow may have reprogrammed them. | WatchMeGrow / installer |
| Internet **upload** speed at each school | Each camera needs roughly **1–3 Mbps of upload** (estimate). 10 cameras ≈ 10–30 Mbps. | A speed test (e.g. fast.com) on the school network during the day |
| Contract end date and notice period | Plan the cut-over before auto-renewal | The WatchMeGrow contract |
| Is audio enabled on any camera? | Recording conversations has stricter consent rules in some states. KidHub's plan is video only. | Installer / director |
| Who handles the school's network today? | Someone needs to plug in the relay and adjust network settings | The owner / IT contact |

### 7.4 Migration steps

1. **Answer the questions above** (owner and WatchMeGrow).
2. **Test one camera.** Install the relay at one school, connect one camera (e.g. the infant room), and send it to the cloud video service. In KidHub, add it under **Cameras** with a short viewing window. The director tests on their phone. WatchMeGrow keeps running the whole time; most IP cameras can send video to two places at once.
3. **Check quality and cost for a week:** picture quality, delay, how the school's internet holds up, and the video service's bill.
4. **Roll out room by room**, matching today's viewing hours (Cameras → viewing windows).
5. **Approve families** (Approvals page). Parents already approved for the KidHub pilot carry over.
6. **Tell families the date** WatchMeGrow stops; then **cancel WatchMeGrow** before its renewal date.
7. If the video server was leased, return it; the cameras and switch stay.

**Who does the on-site work:** someone comfortable with networks, such as the school's IT contact, the original installer, or a local low-voltage/security installer. We'll provide a step-by-step technical guide for them once the questions in §7.3 are answered.

### 7.5 Costs to plan for (rough; get real quotes)

| Item | One-time or ongoing | Notes |
|---|---|---|
| Relay device per school | One-time | A small computer, roughly the cost of a basic laptop or less |
| Cloud video service | Ongoing, usage-based | Charged per hour of video streamed and watched. Get a quote from the provider using the camera count and viewing hours. |
| Installer time | One-time | A few hours per school for setup and testing |
| Internet upgrade | Ongoing, only if needed | Only if the upload speed test is too low |

### 7.6 Privacy and notices

- Tell **families and staff** in advance that the video provider is changing, and when.
- Keep the same **viewing hours and rooms** at first, so nothing changes from a family's point of view.
- Confirm signage and staff notices still match your state's requirements.
- **Recording stays off** unless the school decides otherwise and sets a retention period.

---

## 8. Decisions and questions for the owner

### Decisions

| # | Decision | Options | Suggested |
|---|---|---|---|
| D1 | Build the **spreadsheet import** (item A)? | Yes / no (enter by hand) | Yes, if more than ~30 children |
| D2 | Build **bulk email invitations** (item B)? | Yes / no (send links one by one) | Yes; it also enables "Forgot password?" emails |
| D3 | **Which school goes first?** | Any | The smallest, or the one with the most engaged director |
| D4 | **How families pay** after the switch | (a) old billing app for now / (b) direct payments recorded in KidHub / (c) build online payments first | Decide based on how many families use autopay today |
| D5 | **Camera approach** | Reuse cameras with a relay + cloud video service / keep WatchMeGrow longer | Reuse, after the one-camera test |
| D6 | **Target date** to cancel each old app | Before each renewal date | Work back from the contract dates |
| D7 | **Sender address** for emails to families | e.g. `hello@yourschool.com` | Use the school's own domain |

### Questions only the owner can answer

- [ ] How many schools, classrooms and enrolled children in total? How many on the waitlist?
- [ ] Which schools use Brightwheel and which use Tadpoles? Does any school use both?
- [ ] Renewal or end dates and notice periods for Brightwheel, Tadpoles and WatchMeGrow.
- [ ] How do families pay today (autopay card, ACH, checks, subsidies)? Roughly what share use autopay?
- [ ] Any families with two households paying separately, or with agency/subsidy payments?
- [ ] Any custody restrictions (a parent who must not pick up or view video)? These need careful, manual setup.
- [ ] Who will be the "switch lead" at each school (usually the director)?
- [ ] Who handles the network and cameras today?
- [ ] Anything the current apps do that the school relies on that isn't mentioned here? (e.g. state subsidy reports, lesson plans, check-in kiosk at the door)

---

## 9. Timeline and checklist

A typical sequence for **one school**. Later schools go faster.

| Week | What happens | Done when |
|---|---|---|
| 0 | Owner answers §8; decisions D1–D7 made; contract dates collected | Plan agreed |
| 1 | Build items A/B if chosen. Set up classrooms in KidHub. Ask Tadpoles for the export. Ask WatchMeGrow the §7.3 questions. | Exports in hand |
| 2 | Import children and families; director checks it (especially allergies). Staff invited and trained. | Director signs off on the data |
| 2 | "We're switching" letter to families, then invitations | Most families joined |
| 3–4 | **Side-by-side:** teachers use KidHub for check-in/out and daily reports; the old app is still available. Fix anything that comes up. | Teachers comfortable; families reading reports |
| 3–4 | One-camera test at this school | Director happy with video |
| 5 | **Billing cut-over** on the 1st of the month; old autopay off | First month billed correctly |
| 5–6 | Cameras room by room; families approved for video | All rooms live |
| 6+ | Families told the old apps are ending; photos downloaded; **cancel the old apps** before renewal | Old subscriptions cancelled |

### Master checklist

**Before**
- [ ] Decisions D1–D7 made
- [ ] Contract dates and notice periods known for all three apps
- [ ] Exports received (Brightwheel roster + contacts; Tadpoles roster or template)
- [ ] Billing balances and payment history downloaded from the old app
- [ ] Camera questions answered (§7.3)

**Data**
- [ ] Classrooms set up (ratios, capacity, care intervals)
- [ ] Children and families imported
- [ ] Every allergy and medical note checked by hand
- [ ] Pickup lists checked for a sample of children
- [ ] Staff invited; directors and owner set up two-step verification

**Families**
- [ ] "We're switching" letter sent
- [ ] Invitations sent; follow-up for anyone who hasn't joined after 3 days
- [ ] Video access approved for families
- [ ] Photo download deadline announced

**Billing**
- [ ] Tuition plans created
- [ ] Opening balances entered
- [ ] Old autopay switched off from the cut-over date
- [ ] First KidHub billing run checked before families see it

**Cameras**
- [ ] One camera tested for a week
- [ ] All rooms moved; viewing hours match
- [ ] Families and staff told about the provider change
- [ ] WatchMeGrow cancelled; leased equipment returned if applicable

**After**
- [ ] Old apps cancelled before renewal
- [ ] Local copies of exports deleted
- [ ] 30-day check-in with the director and a few families

---

## 10. Risks and how we avoid them

| Risk | How we avoid it |
|---|---|
| An allergy or medical note is wrong or missing after import | The director checks every child with an allergy by hand before go-live; the import preview flags empty fields |
| A family is charged twice during the billing switch | Switch at the start of a month; turn off old autopay first; check the first KidHub billing run before families see it |
| Families don't join | Letter first, then invitation; resend after 3 days; director helps at drop-off |
| Teachers find it slower than the old app | Two-week side-by-side period; feedback each week; the multi-child care log is designed to be faster |
| Camera downtime | WatchMeGrow keeps running until KidHub video is proven room by room |
| School internet can't handle the video | Upload speed test before rollout; one-camera trial first |
| A custody restriction is missed | Set these up by hand with the director; confirm the pickup list and video access for those children specifically |
| Old contract auto-renews | Collect renewal dates in week 0 and plan cancellation dates backwards |
| Export files leak | Kept in one secure place, shared only with whoever does the import, deleted after checking |

---

## 11. Sources

- Brightwheel help center: [Roster export](https://intercom.help/brightwheel/en/articles/942385-roster-export)
- Playground (a third-party childcare app) migration guide describing Brightwheel's Contacts report: [Brightwheel migration](https://help.tryplayground.com/en/articles/5561423-brightwheel-migration)
- WatchMeGrow: [How it works](https://watchmegrow.com/schools/product/how-it-works) (equipment and installation)
- WatchMeGrow: [Convert your cameras](https://watchmegrow.com/schools/product/convert-your-cameras) (reusing existing IP cameras)
- Tadpoles: no public export documentation was found; confirm with Tadpoles support.

*Related: [README](../README.md) (setup), [PILOT.md](PILOT.md) (one-week pilot), [COMMERCIALIZATION.md](COMMERCIALIZATION.md) (product roadmap).*
