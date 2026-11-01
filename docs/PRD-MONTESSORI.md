# PRD: KidHub for Montessori Schools (msphere parity + Montessori-native record keeping)

| | |
|---|---|
| **Status** | Draft for review with the owner of Bright Star Children's Montessori |
| **Owner** | Product (KidHub) |
| **Reviewers** | Head of school / owner, lead guides, one assistant guide, two families |
| **Related** | [COMMERCIALIZATION.md](COMMERCIALIZATION.md) (roadmap), [MIGRATION.md](MIGRATION.md) (switching), [README](../README.md) |

> **About the competitor information in this document.** msphere's website and app listing couldn't be opened directly from the environment this was written in. What's said about msphere comes from search-engine summaries of its public pages (cited in [§14](#14-sources)) and is marked *unverified*. **Before building, run a hands-on msphere trial or demo and update the parity table in [§4](#4-msphere-parity).**

---

## Contents

1. [Summary](#1-summary)
2. [Problem and opportunity](#2-problem-and-opportunity)
3. [Montessori principles the product must honor](#3-montessori-principles-the-product-must-honor)
4. [msphere parity](#4-msphere-parity)
5. [Users and jobs to be done](#5-users-and-jobs-to-be-done)
6. [Scope and release plan](#6-scope-and-release-plan)
7. [Functional requirements](#7-functional-requirements)
8. [AI in a Montessori setting](#8-ai-in-a-montessori-setting)
9. [Data model](#9-data-model)
10. [Privacy, security and permissions](#10-privacy-security-and-permissions)
11. [Non-functional requirements](#11-non-functional-requirements)
12. [Success metrics](#12-success-metrics)
13. [Risks, open questions and decisions](#13-risks-open-questions-and-decisions)
14. [Sources](#14-sources)

---

## 1. Summary

KidHub today is a general childcare platform: attendance, care logs, daily reports, billing, messaging, live video, multi-school oversight and safety alerts. Montessori schools also need **Montessori record keeping**: a curriculum organized by Montessori areas, a record of which lessons each child has been **presented**, is **practicing** and has **mastered**, narrative **observations**, **portfolios**, and **progress reports and conferences** that describe a child's development without grades or comparisons.

msphere is a Montessori-specific school app that covers these needs alongside daily care, family messaging, a calendar, billing and forms. For Bright Star Children's Montessori, and for Montessori schools generally, KidHub must:

1. **Match msphere** on everything a Montessori school uses day to day (see [§4](#4-msphere-parity)).
2. **Be Montessori-native**, not a generic app with renamed labels (see [§3](#3-montessori-principles-the-product-must-honor)).
3. **Keep KidHub's advantages:** live classroom video with family permissions, owner view across schools, safety and compliance alerts, and the AI assistant, all in one login.

**One-line goal:** *A Montessori guide can record a lesson, an observation and a diaper change from the same screen in seconds, and a family receives a warm, factual picture of their child's growth, while the head of school sees every classroom, every child's lesson coverage, and every safety issue.*

---

## 2. Problem and opportunity

**For guides:** record keeping is often split between paper matrices, binders, spreadsheets and a separate parent app. Observations are written twice (once for the record, once for parents). Progress reports take evenings and weekends.

**For heads of school:** no single view of lesson coverage across classrooms (which children haven't received a lesson in weeks, which areas are under-presented) next to attendance, ratios and billing.

**For families:** daily-care apps show meals and naps but rarely explain *what the child is learning* in Montessori terms. Families new to Montessori don't know what "Pink Tower" or "Practical Life" mean.

**For the owner (multi-site):** consistent curriculum and reporting across schools, one vendor instead of three or four.

**Opportunity:** msphere shows that Montessori schools value a purpose-built tool. KidHub can combine Montessori record keeping with operations, live video and multi-site oversight in one product, something none of the incumbents the owner uses today does.

---

## 3. Montessori principles the product must honor

These are **product rules**, not just copy. Each has a concrete consequence in the requirements.

| Principle | What it means | Product rule |
|---|---|---|
| **Follow the child** | Each child progresses at their own pace, guided by readiness and interest, not a fixed schedule | Progress is tracked **per child, per lesson**, with no class-wide pacing targets. "Ready for next" suggestions come from that child's own record and the lesson sequence. |
| **No grades, no ranking, no comparison** | Montessori assessment is observational; letter grades and ratings aren't used | **No scores, percentages, grades, class ranks or "behind/ahead of peers" labels anywhere families can see.** Staff-only coverage reports describe lessons, not child worth. The AI must not produce comparative or evaluative labels ([§8](#8-ai-in-a-montessori-setting)). |
| **Observation is the core tool** | Guides learn what each child needs by observing objectively | Observations are first-class records: fast to capture, factual by default, linkable to lessons and areas, private by default. |
| **Prepared environment & curriculum areas** | Materials are organized by area and introduced in sequence | The curriculum is a structured library: **level → area → sub-area → lesson/material**, with sequence and prerequisites. |
| **Mixed ages and the three-year cycle** | Children typically stay with the same guide for about three years in a mixed-age room | Records follow the child across years and classrooms. Classrooms have an **age range** rather than a single grade. Year-end doesn't reset progress. |
| **Uninterrupted work period** | Long blocks of focused work (often around three hours in Primary) | The guide app is designed for **minimal interruption**: one-tap capture, batch entry, no mandatory fields during the work period, finish details later. |
| **Freedom within limits; Grace & Courtesy** | Social and emotional development is part of the curriculum | Grace & Courtesy and social-emotional lessons are curriculum items like any other; observations can be tagged to them. |
| **Planes of development** | Needs differ by age: Infant (Nido), Toddler (Young Children's Community), Primary/Children's House (about 3–6), Elementary (about 6–12) | Curriculum, daily care and report templates vary by **program level**. |
| **Partnership with families** | Families are supported to understand and extend the approach at home | Family-facing views explain lessons in plain language, with optional "try at home" ideas, and families can share home observations back. |
| **Respect for the child's privacy and dignity** | Children are not on display | Photos and observations are **private until a guide chooses to share**. No public galleries. Video access stays under center control (already built). |

**Terminology** (configurable per school, default for Montessori schools):

| Generic KidHub | Montessori default |
|---|---|
| Teacher | **Guide** (Lead Guide / Assistant Guide) |
| Classroom | **Classroom / Community** (e.g. "Children's House", "Nido", "Young Children's Community") |
| Activity / milestone | **Lesson / Work / Observation** |
| Progress | **Presented → Practicing → Mastered** (labels configurable, e.g. "Working" instead of "Practicing") |

---

## 4. msphere parity

Status of each msphere capability **as publicly described** (unverified), and what KidHub needs.

| Capability | msphere (public description) | KidHub today | Required for parity | Requirement |
|---|---|---|---|---|
| Roster | ✅ | ✅ | — | — |
| Attendance / check-in | ✅ attendance; families check in | ✅ staff check-in with approved-pickup check | **Family self check-in** (kiosk/PIN/QR) | [F12](#f12-family-check-in) |
| Daily care: meals, naps | ✅ | ✅ plus diapers, bottles, timers | — | — |
| Observations | ✅ | Partial: "Milestone" entries with a development area | Montessori observations linked to lessons/areas; private vs shared | [F4](#f4-observations) |
| Curriculum progress (Presented / Working / Mastered) | ✅ (printable matrix template; positioned as core) | ❌ | Curriculum library + lesson records + matrix | [F2](#f2-curriculum-library), [F3](#f3-lesson-records-and-progress-matrix) |
| Photos | ✅ | ✅ with approval workflow | — | — |
| Videos (clips) | ✅ | ❌ | Short video clips in records and the family feed | [F13](#f13-video-clips) |
| Portfolios | ✅ | Partial: Milestones page | Per-child portfolio across years, exportable | [F6](#f6-portfolio) |
| Progress reports | ✅ (sample/template: factual observations, P/W/M, short family note) | ❌ | Term reports built from records, review workflow, PDF | [F7](#f7-progress-reports) |
| Parent–teacher conferences | ✅ (template) | ❌ | Scheduling + prep packet + notes | [F8](#f8-conferences) |
| Parent journal | ✅ | Partial: daily report + messages | Two-way home connection: families share home notes/photos | [F9](#f9-family-journal-home-connection) |
| Messaging with the guide | ✅ | ✅ realtime per-child thread | — | — |
| School calendar | ✅ | ❌ (announcements only) | Calendar with events, closures, conferences, phone-calendar subscription | [F10](#f10-school-calendar) |
| Billing | ✅ | ✅ recurring/split billing, statements (no online payments yet) | Online payments (already on roadmap) | COMMERCIALIZATION §6.2 |
| Forms | ✅ | ❌ | Digital forms with e-signature and completion tracking | [F11](#f11-forms-and-e-signature) |
| Native iOS app | ✅ (App Store) | ❌ web only (works on phones) | Native guide + family apps | COMMERCIALIZATION §6.1 |
| Free record-keeping templates (marketing) | ✅ | ❌ | Publish printable templates and guides | [F16](#f16-printable-templates-and-exports) |
| Live classroom video | Not described | ✅ | KidHub advantage | — |
| Multi-school owner view | Not described | ✅ | KidHub advantage | — |
| Safety/compliance alerts, AI assistant | Not described | ✅ | KidHub advantage; extend to lesson coverage | [F17](#f17-head-of-school-insights-and-alerts) |

**Verification task (before build):** sign up for an msphere trial or demo and record: the exact progress statuses and whether they're configurable; curriculum library contents and editing; observation fields; report templates and export format; conference flow; family app screens; pricing. Update this table.

---

## 5. Users and jobs to be done

| Persona | Context | Top jobs |
|---|---|---|
| **Lead Guide** (Primary / Children's House) | 20–30 children aged ~3–6, mixed ages; on the floor all morning | Record lessons given today in seconds; capture observations without breaking the work period; see who is ready for which next lesson; write term reports without losing weekends |
| **Assistant Guide** | Supports the lead; often handles daily care | Log care and quick observations; see allergies and pickups; never see billing |
| **Infant/Toddler Guide** (Nido / YCC) | Care-heavy day; language and movement milestones | Daily care (already built) plus movement, language and practical-life observations; toileting learning |
| **Head of School / Director** | Runs one school | Lesson coverage across classrooms; report review and sign-off; conferences; calendar; forms; plus existing ops (attendance, billing, approvals) |
| **Owner** (multi-site) | Several schools | Consistent curriculum and reporting across schools; cross-school dashboards (already built) |
| **Family** | Parents, sometimes new to Montessori | Understand what their child is learning and why; see shared observations and photos; read reports; book conferences; share home notes; sign forms; pay |

**Example user stories**

- *As a Lead Guide,* after presenting the Pink Tower to three children, I tap the lesson once, select the three children, and it's recorded as "Presented" with today's date.
- *As a Lead Guide,* I open the **classroom matrix** for Sensorial and see at a glance who has mastered the Pink Tower and is ready for the Brown Stair.
- *As a Lead Guide,* I write a factual observation ("Chose the Pink Tower independently, built it three times, self-corrected twice, worked for 25 minutes") and link it to the lesson. It stays private until I share it.
- *As a Head of School,* I see that four children in Room 2 haven't been presented a new lesson in three weeks, and look into it with the guide.
- *As a Family,* I read my child's term report: what she's working on in each area, in plain language, with photos and a warm note from her guide. Nothing compares her to other children.
- *As a Family,* I book a conference slot and receive the report before the meeting.

---

## 6. Scope and release plan

| Milestone | Contents | Why first |
|---|---|---|
| **M1: Montessori core** | F1 Montessori mode and terminology · F2 Curriculum library (starter library + editing) · F3 Lesson records and progress matrix · F4 Observations · F17 lesson-coverage insight (basic) | The heart of Montessori record keeping; the biggest parity gap; demo-able to the owner |
| **M2: Reporting and families** | F5 Lesson planning · F6 Portfolio · F7 Progress reports (with AI draft) · F8 Conferences · F9 Family journal · F10 School calendar | Replaces paper reports and conferences; families feel the difference |
| **M3: Operations parity** | F11 Forms and e-signature · F12 Family check-in · F13 Video clips · F14 Infant/toddler specifics · F15 Import from other systems · F16 Printable templates and exports | Completes msphere parity on operations |
| **Parallel (roadmap)** | Native apps, online payments | Already in COMMERCIALIZATION.md |

**Out of scope for now:** Elementary-specific features beyond the curriculum library (e.g. student-facing work journals), accreditation reporting for AMI/AMS, standards-alignment certification, admissions/CRM.

---

## 7. Functional requirements

Priority: **P0** (must for the milestone), **P1** (should), **P2** (could).

### F1. Montessori mode and terminology

| ID | Requirement | Pri |
|---|---|---|
| F1.1 | School setting **Program type**: Montessori / General. Montessori mode turns on F2–F9 and Montessori terminology. | P0 |
| F1.2 | Per-school **label overrides**: teacher → Guide; staff roles **Lead Guide** and **Assistant Guide** (map to existing teacher role, plus an optional "lead" flag); classroom → community names. | P0 |
| F1.3 | Classroom **program level**: Nido (infant), Young Children's Community (toddler), Primary / Children's House, Lower Elementary, Upper Elementary; and an **age range** (e.g. 3–6). | P0 |
| F1.4 | **Progress status labels** configurable per school, default *Presented / Practicing / Mastered*; optional fourth status *Needs re-presentation*. Status order is fixed (it's a sequence). | P0 |

**Acceptance:** with Montessori mode on, every staff-facing and family-facing screen uses the school's terms; turning it off restores the generic terms with no data lost.

### F2. Curriculum library

| ID | Requirement | Pri |
|---|---|---|
| F2.1 | Hierarchy: **Program level → Area → Sub-area → Lesson** (a lesson usually corresponds to a material or presentation). | P0 |
| F2.2 | Default areas for Primary: **Practical Life, Sensorial, Language, Mathematics, Cultural** (sub-areas e.g. Geography, Botany, Zoology, Science, History, Art, Music), plus **Grace & Courtesy**. Infant/toddler areas: Movement, Language, Practical Life / Care of Self, Sensorial exploration, Art & Music, Social-emotional. | P0 |
| F2.3 | Each lesson has: name, area/sub-area, **sequence order**, optional **prerequisites** (other lessons), typical age range, a short **plain-language family description**, optional "try at home" idea, optional internal notes. | P0 |
| F2.4 | **Starter library** supplied by KidHub with common lesson names and family descriptions written by us. **No copying of proprietary training albums** (see [§13](#13-risks-open-questions-and-decisions)). | P0 |
| F2.5 | Schools can **add, rename, reorder, hide and archive** lessons and areas; changes never delete children's existing records. | P0 |
| F2.6 | **Organization-level library** shared by all schools of an owner, with optional per-school additions. | P1 |
| F2.7 | **Import/export** the library as CSV (to bring in a school's own album list, or move from msphere/paper). | P1 |
| F2.8 | Optional tags linking lessons to **state early-learning guidelines** or developmental domains (school-defined). | P2 |

### F3. Lesson records and progress matrix

| ID | Requirement | Pri |
|---|---|---|
| F3.1 | Record a **lesson event** for one or more children: lesson, status (Presented / Practicing / Mastered / Needs re-presentation), date (default today), guide, optional note. Multi-child entry reuses the care-log pattern (select children → one tap). | P0 |
| F3.2 | A child's **current status per lesson** is the latest event; **full history** is kept (dates of each presentation and each status change). | P0 |
| F3.3 | **Classroom matrix**: rows = children, columns = lessons (filter by area/sub-area); each cell shows status with color and date; tap a cell to update. Must handle ~30 children × ~400 lessons smoothly. | P0 |
| F3.4 | **Child view**: all areas with status per lesson, timeline, linked observations and photos. | P0 |
| F3.5 | **"Ready for next"** suggestions per child: lessons whose prerequisites are mastered (or whose previous lesson in sequence is), not yet presented. Suggestions only; the guide decides. | P1 |
| F3.6 | **Quick capture during the work period**: a compact mobile screen (recent lessons and children first, search), usable one-handed, with entries editable later. | P0 |
| F3.7 | Bulk actions: mark a lesson presented to a small group; move a child to Mastered after review. | P1 |
| F3.8 | Year-to-year continuity: records follow the child across classrooms and school years; promoting a child to the next level keeps history. | P0 |
| F3.9 | **No numeric scores, percentages or rankings** in family-facing views. Staff views may show counts (e.g. "lessons presented this month") for planning only. | P0 |

**Acceptance:** a guide can record "Presented" for 3 children in ≤ 10 seconds on a phone; the matrix for a 25-child Primary classroom loads in < 2 seconds.

### F4. Observations

| ID | Requirement | Pri |
|---|---|---|
| F4.1 | Observation record: one or more children, date/time, **factual narrative**, optional links to lessons and areas, optional photo/video, optional tags (e.g. concentration, independence, social, Grace & Courtesy). | P0 |
| F4.2 | **Private by default.** Explicit "Share with family" per observation; shared ones appear in the family feed and portfolio. | P0 |
| F4.3 | **Objectivity prompt**: an optional inline hint encouraging factual language ("what did you see and hear?"); the AI assistant can flag evaluative words for the guide to reconsider (never auto-edits). | P1 |
| F4.4 | Fast capture: from the child, from the matrix cell, or from the care log; draft autosave; voice-to-text where the device supports it. | P1 |
| F4.5 | Existing "Milestone" (observation) care-log entries migrate into the new observation records. | P0 |
| F4.6 | Observation **search and filter** by child, area, lesson, tag, date, guide. | P1 |

### F5. Lesson planning

| ID | Requirement | Pri |
|---|---|---|
| F5.1 | **Weekly plan** per child or small group: lessons the guide intends to present, seeded from "Ready for next" (F3.5). | P1 |
| F5.2 | Planned lessons appear in quick capture so recording them takes one tap. | P1 |
| F5.3 | Plans are staff-only. | P0 |

### F6. Portfolio

| ID | Requirement | Pri |
|---|---|---|
| F6.1 | Per-child portfolio: shared observations, photos/videos, mastered lessons, reports, across years. Replaces/extends today's Milestones page. | P0 |
| F6.2 | Family view of the portfolio (shared items only), with lesson names explained in plain language. | P0 |
| F6.3 | **Export** a portfolio for a date range as PDF (year-end keepsake, transition to a new school). | P1 |

### F7. Progress reports

| ID | Requirement | Pri |
|---|---|---|
| F7.1 | **Report templates** per program level and term (e.g. fall/spring), defined by the school: sections per area with (a) narrative and (b) lesson-progress summary in P/P/M terms; optional social-emotional / Grace & Courtesy section; **family note**. | P0 |
| F7.2 | **Auto-assembled draft** per child: the lessons presented/practiced/mastered this term per area, selected shared observations and photos. | P0 |
| F7.3 | **AI-drafted narratives and family note** from the child's records only, following [§8](#8-ai-in-a-montessori-setting) rules; the guide must review and edit. Drafts are clearly marked "AI draft". | P1 |
| F7.4 | **Workflow:** Draft → Guide ready → Head of school approved → Published to family. Comments between head and guide. | P0 |
| F7.5 | Families read reports in the app and download a **PDF**. Published reports are immutable (a correction creates a new version). | P0 |
| F7.6 | **No grades or comparative language**; template validation warns about rating scales. | P0 |
| F7.7 | Head-of-school dashboard: report completion per classroom. | P1 |

### F8. Conferences

| ID | Requirement | Pri |
|---|---|---|
| F8.1 | Head/guide publishes **conference slots** (in person or video call link); families book, reschedule and cancel; reminders. | P1 |
| F8.2 | **Prep packet** auto-generated: latest report, portfolio highlights, family's questions (families can submit questions in advance). | P1 |
| F8.3 | **Conference notes**: private notes plus an optional shared summary with agreed next steps. | P1 |

### F9. Family journal (home connection)

| ID | Requirement | Pri |
|---|---|---|
| F9.1 | Families can post **home notes** (text/photo) to their child's journal: e.g. "slept poorly", "was fascinated by pouring water at home". Guides see them on the morning dashboard. | P1 |
| F9.2 | Lesson pages shared with families include an optional **"try at home"** idea (from F2.3). | P1 |
| F9.3 | Home notes are visible to the child's guides and directors only. | P0 |

### F10. School calendar

| ID | Requirement | Pri |
|---|---|---|
| F10.1 | Events: school-wide or per classroom; types: event, closure, conference window, deadline. | P1 |
| F10.2 | Family view; **subscribe in phone calendars** (private ICS link per family). | P1 |
| F10.3 | Closures automatically show as announcements; billing can optionally skip closure days (future). | P2 |

### F11. Forms and e-signature

| ID | Requirement | Pri |
|---|---|---|
| F11.1 | Form builder (text, choices, date, file upload, **signature**). | P1 |
| F11.2 | Assign forms to families/classrooms (enrollment packet, field-trip permission, medication authorization, photo consent); track completion and send reminders. | P1 |
| F11.3 | Signed forms are stored as immutable PDFs on the child's record; photo-consent answers drive photo-sharing defaults. | P1 |

### F12. Family check-in

| ID | Requirement | Pri |
|---|---|---|
| F12.1 | **Kiosk mode** on a front-door tablet: family enters a PIN or scans a QR from their phone to check in/out; optional signature; optional health questions. | P1 |
| F12.2 | Check-out uses the existing **approved-pickup validation**. | P0 (when F12 ships) |
| F12.3 | Guides see arrivals live in the classroom view. | P1 |

### F13. Video clips

| ID | Requirement | Pri |
|---|---|---|
| F13.1 | Short video clips (e.g. ≤ 60 s) on observations, lessons and the family feed, with the same approval workflow as photos. | P1 |
| F13.2 | Compression on upload; streaming playback through expiring links (same model as photos). | P1 |

### F14. Infant and toddler specifics

| ID | Requirement | Pri |
|---|---|---|
| F14.1 | Nido/YCC curriculum areas (F2.2) and observation tags for movement, language, care of self, toileting learning. | P1 |
| F14.2 | Daily care (already built) shown alongside observations in one infant/toddler daily view. | P1 |

### F15. Import from other systems

| ID | Requirement | Pri |
|---|---|---|
| F15.1 | CSV import of lesson history (child, lesson, status, date) and observations, with column mapping and preview, matching the planned roster import in MIGRATION.md. | P1 |
| F15.2 | Lesson-name matching against the school's library, with a review step for unmatched names. | P1 |

### F16. Printable templates and exports

| ID | Requirement | Pri |
|---|---|---|
| F16.1 | Printable **progress matrix**, **observation log**, **daily care sheet**, **conference template** (blank and filled from KidHub data). | P2 |
| F16.2 | Public, free versions of these templates on the KidHub website as marketing (GTM; see COMMERCIALIZATION §13.3). | P2 |

### F17. Head-of-school insights and alerts

Extends the existing alerts engine (`src/lib/domain/alerts.ts`).

| ID | Requirement | Pri |
|---|---|---|
| F17.1 | **Lesson coverage** per classroom: children with no new presentation in N school days (configurable, default 10); areas with few presentations this month. Shown to heads/owners and the classroom's guides. | P0 |
| F17.2 | Coverage alerts are **informational** ("Consider checking in"), never labels on the child, and never shown to families. | P0 |
| F17.3 | Report and conference completion status per classroom (with F7/F8). | P1 |
| F17.4 | The AI assistant can answer Montessori questions about the school's own data, e.g. "Which Primary children are ready for the Golden Beads?" (suggestions only). | P1 |

---

## 8. AI in a Montessori setting

KidHub's rule stays: **AI answers and drafts; people decide and send.** For Montessori, add:

| Rule | Detail |
|---|---|
| **Only the child's own records** | Drafts use the child's lesson records, shared and private observations (private ones only for staff-facing drafts), and the template. No outside data, and no data from other children. |
| **No grading, ranking or comparison** | The model is instructed never to produce scores, levels, percentiles, "above/below average", "behind peers" or diagnostic-sounding language. Output is checked for a deny-list of such terms; matches are highlighted to the guide. |
| **Factual and warm** | Narratives describe observed behavior and work in Montessori terms, with a warm family-facing tone; claims must trace to a record (draft shows which records each sentence came from). |
| **No diagnoses** | Never suggests developmental delays, disorders or medical conditions. If records mention concerns, the draft says nothing and the guide is reminded to discuss with the head of school. |
| **Human review required** | Nothing AI-drafted reaches a family without a guide's edit/approval step (and head approval for reports). |
| **Transparency** | Families can be told the school uses AI drafting reviewed by guides (school setting). |
| **Model and cost** | Uses the existing Claude integration; per-school usage caps; drafts generated on request, not in bulk without confirmation. |

---

## 9. Data model

New tables (Postgres, with RLS like the existing schema). Names are proposals.

```sql
-- F1
alter table schools add column program_type text not null default 'general';   -- 'general' | 'montessori'
alter table schools add column labels jsonb not null default '{}'::jsonb;        -- terminology overrides
alter table schools add column progress_labels text[] not null default '{Presented,Practicing,Mastered}';
alter table classrooms add column program_level text;                            -- nido | ycc | primary | lower_el | upper_el
alter table classrooms add column min_age_months int, add column max_age_months int;
alter table school_staff add column is_lead boolean not null default false;

-- F2: curriculum (org-level library, optional school additions)
create table curriculum_areas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  school_id uuid references schools on delete cascade,        -- null = shared by all the org's schools
  program_level text not null, name text not null, parent_id uuid references curriculum_areas,
  sort int not null default 0, archived boolean not null default false);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations on delete cascade,
  school_id uuid references schools on delete cascade,
  area_id uuid not null references curriculum_areas,
  name text not null, sort int not null default 0,
  min_age_months int, max_age_months int,
  family_description text, try_at_home text, staff_notes text,
  archived boolean not null default false);

create table lesson_prerequisites (lesson_id uuid references lessons on delete cascade,
  requires_id uuid references lessons on delete cascade, primary key (lesson_id, requires_id));

-- F3: append-only history; current status = latest row per (child, lesson)
create table lesson_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools on delete cascade,
  child_id uuid not null references children on delete cascade,
  lesson_id uuid not null references lessons,
  status smallint not null,               -- index into schools.progress_labels (0 Presented … 3 Needs re-presentation)
  recorded_on date not null default current_date,
  guide_id uuid references profiles on delete set null,
  note text, batch_id uuid, created_at timestamptz not null default now());
create index on lesson_records (child_id, lesson_id, recorded_on desc);

-- F4
create table observations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools on delete cascade,
  author_id uuid references profiles on delete set null,
  observed_at timestamptz not null default now(),
  body text not null, tags text[] not null default '{}',
  shared_with_family boolean not null default false,
  media_path text, created_at timestamptz not null default now());
create table observation_children (observation_id uuid references observations on delete cascade,
  child_id uuid references children on delete cascade, primary key (observation_id, child_id));
create table observation_lessons (observation_id uuid references observations on delete cascade,
  lesson_id uuid references lessons, primary key (observation_id, lesson_id));

-- F7
create table report_templates (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools on delete cascade,
  program_level text, name text not null, sections jsonb not null);
create table progress_reports (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools on delete cascade,
  child_id uuid not null references children on delete cascade, template_id uuid references report_templates,
  term text not null, status text not null default 'draft',   -- draft | guide_ready | approved | published
  content jsonb not null, ai_assisted boolean not null default false,
  published_at timestamptz, version int not null default 1);

-- F8, F9, F10, F11: conference_slots, journal_entries, calendar_events, forms / form_assignments / form_responses
```

**RLS outline:**
- `lesson_records`, private `observations`, plans and report drafts: **staff of the school**. Assistant guides can create but not delete.
- Family read access: shared observations, **published** reports, their own journal entries, and lesson family descriptions for lessons recorded for their child. Never `staff_notes`.
- Curriculum read: staff of the org's schools; write: heads/owners.
- All new tables get **audit triggers** (0002 pattern) and **policy tests** in `tests/db/`.

---

## 10. Privacy, security and permissions

| Data | Who can see it |
|---|---|
| Private observations, lesson records, plans, report drafts, conference private notes | Staff of the child's school (guides, head, owner) |
| Shared observations, portfolio, published reports, conference shared summary | Above plus the child's **full** guardians (not video-only family) |
| Home journal notes | The child's guardians and the school's staff |
| Curriculum library | Staff; families see only family descriptions of lessons recorded for their child |
| Coverage insights | Staff only; never shown to families |

**Additional rules:**
- Observations and reports are **education records**: retention follows the school's policy (see COMMERCIALIZATION §10.4). A family export is available on request.
- Media on observations follows the existing photo approval and expiring-link model, extended to video.
- Report PDFs carry no tracking and are generated on demand.
- Every change to lesson records, observation sharing, and report status is in the **audit log**.
- No observation or report content is used to train AI models (existing policy).

---

## 11. Non-functional requirements

| Area | Requirement |
|---|---|
| **Speed of capture** | Lesson record for 1–3 children in ≤ 10 s on a phone; observation capture opens in < 1 s |
| **Matrix performance** | 30 children × 400 lessons renders in < 2 s; cell update < 300 ms perceived |
| **Offline** | Lesson records and observations can be captured offline in the native app and synced (ties into COMMERCIALIZATION §6.4) |
| **Accessibility** | WCAG 2.2 AA; color is never the only status indicator in the matrix (icon + text) |
| **Localization** | Family-facing text translatable; Spanish first |
| **Printing** | Reports and matrices print cleanly on Letter/A4 |
| **Data portability** | Full export of curriculum, lesson records, observations and reports (CSV + PDF) |
| **Testing** | Domain logic (status/readiness/coverage) unit-tested; RLS tests for every new table; e2e walkthrough as guide, head and family |

---

## 12. Success metrics

| Metric | Target (first term after launch at Bright Star) |
|---|---|
| Guides recording lessons in KidHub (not paper) | ≥ 90% of lessons presented |
| Median time to record a lesson | ≤ 10 seconds |
| Term reports completed in KidHub | 100% of enrolled children |
| Guide time to complete a report (self-reported) | 50% less than the previous process |
| Families reading their child's report | ≥ 80% within 7 days of publishing |
| Children with no new presentation in 10 school days | Trending down (coverage insight in use) |
| Paper record-keeping retired | Yes, by end of term |
| Owner decision | Bright Star chooses KidHub over msphere for the next school year |

---

## 13. Risks, open questions and decisions

### Risks

| Risk | Mitigation |
|---|---|
| **Curriculum copyright.** Montessori training albums (e.g. from AMI or AMS training centers) are proprietary. | Ship a starter list of *lesson names* with descriptions **written by us**; let schools import their own lists. Never copy album text. Legal review before publishing the starter library. |
| Guides resist double entry during transition | Import (F15); a 2-week overlap with paper; quick capture designed for the floor |
| AI drafts sound generic or evaluative | Strict prompts + deny-list + mandatory review; pilot with one guide first |
| Matrix becomes overwhelming on a phone | Filter by area/sub-area; child view as the default on small screens |
| Feature parity claims go stale | Verification task in §4; re-check msphere quarterly |
| Families misread progress as grades | Plain-language explanations of Presented/Practicing/Mastered in the family app; no scores |

### Open questions for the owner / head of school

1. Which **progress labels** does Bright Star use today (Presented / Practicing / Mastered, or Working, or something else)? Any fourth status?
2. Which **program levels** does Bright Star run (Nido, YCC, Primary, Elementary)? How many classrooms per level?
3. Is the school affiliated with **AMI, AMS** or another body, and are there reporting expectations from it?
4. What does Bright Star use for record keeping today: **msphere**, another app, or paper? Can we get an **export** or sample (with fake names) to plan the import?
5. What is the school's **curriculum list** (album table of contents)? Can the school share its own lesson list for import?
6. **Report cadence and format:** how many reports a year, which sections, and does the head sign off?
7. **Conferences:** how often, in person or video, and how long are slots?
8. Are **observations shared with families** today, and how often?
9. Which **forms** do families sign each year?
10. Must-have items from msphere that this PRD misses?

### Decisions needed

| # | Decision | Default proposal |
|---|---|---|
| P1 | Default progress labels | Presented / Practicing / Mastered (+ optional Needs re-presentation) |
| P2 | Curriculum ownership | Org-level library shared by all schools, with per-school additions |
| P3 | Observation default visibility | Private until shared |
| P4 | AI drafting for reports at launch | On, with mandatory review (M2) |
| P5 | Milestone order | M1 → M2 → M3 as in §6 |

---

## 14. Sources

msphere (search-engine summaries; site and App Store listing could not be opened directly):
- [msphere: Montessori record keeping resources & guides](https://msphere.biz/resources)
- [msphere: Free Montessori record-keeping templates](https://msphere.biz/resources/montessori-record-keeping-templates)
- [msphere on the App Store](https://apps.apple.com/us/app/msphere/id6777834759)

Montessori practice and reporting:
- [NAMC: How progress reports work in the Montessori classroom](https://montessoritraining.blogspot.com/2007/10/progress-reports_03.html)
- [United Montessori: Montessori progress reports](https://www.unitedmontessori.com/blog/progress-reporting/)

Comparable Montessori software (for pricing and feature context):
- [Montessori Compass pricing](https://www.montessoricompass.com/pricing/)
- [Montopia](https://montopia.ymontessori.com/)
- [Observer](https://www.observer.school/)
- [Montessori Workspace](https://www.montessoriworkspace.com/)
