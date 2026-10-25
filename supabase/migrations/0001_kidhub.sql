-- KidHub schema, row-level security, storage and RPCs.
-- Paste this whole file into the Supabase SQL editor (or run `supabase db push`).
-- Safe to run once on a fresh project.

create extension if not exists pgcrypto;

-- ───────────────────────────── Enums ─────────────────────────────
create type staff_role as enum ('director', 'teacher');
create type child_status as enum ('enrolled', 'waitlist', 'withdrawn');
create type guardian_access as enum ('full', 'video_only');
create type activity_type as enum (
  'nap_start', 'nap_end', 'meal', 'bottle', 'diaper', 'potty',
  'photo', 'note', 'observation', 'incident', 'medication'
);
create type invoice_status as enum ('open', 'paid', 'void');
create type bill_frequency as enum ('weekly', 'monthly');
create type announcement_kind as enum ('info', 'closure', 'emergency');
create type invite_role as enum ('director', 'teacher', 'guardian');

-- ───────────────────────────── Tables ─────────────────────────────
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Owners see and administer every school in the organization (multi-site oversight).
create table org_owners (
  org_id uuid not null references organizations (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  primary key (org_id, profile_id)
);

create table schools (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  timezone text not null default 'America/Los_Angeles',
  address text,
  opens_at time not null default '07:00',
  closes_at time not null default '18:00',
  require_photo_approval boolean not null default false,
  created_at timestamptz not null default now()
);

create table school_staff (
  school_id uuid not null references schools (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  role staff_role not null,
  primary key (school_id, profile_id)
);

create table classrooms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  name text not null,
  age_group text not null default 'preschool',          -- infant | toddler | preschool | school_age
  ratio integer not null default 10 check (ratio > 0),  -- max children per staff member
  capacity integer,
  diaper_interval_min integer,                          -- null = no diaper timer
  bottle_interval_min integer,                          -- null = no bottle timer
  created_at timestamptz not null default now()
);

create table children (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  classroom_id uuid references classrooms (id) on delete set null,
  first_name text not null,
  last_name text not null,
  birth_date date,
  status child_status not null default 'enrolled',
  allergies text,
  medical_notes text,
  start_date date,
  created_at timestamptz not null default now()
);

create table guardians (
  child_id uuid not null references children (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  relationship text not null default 'parent',
  access guardian_access not null default 'full',
  video_approved boolean not null default false,       -- the center approves every family before video access
  primary key (child_id, profile_id)
);

create table pickups (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  name text not null,
  relationship text,
  phone text,
  is_emergency_contact boolean not null default false,
  can_pickup boolean not null default true,
  created_at timestamptz not null default now()
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  school_id uuid not null references schools (id) on delete cascade,
  day date not null,
  check_in_at timestamptz not null default now(),
  check_in_by uuid references profiles (id),
  dropped_off_by text,
  check_out_at timestamptz,
  check_out_by uuid references profiles (id),
  picked_up_by text,
  unique (child_id, day)
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children (id) on delete cascade,
  school_id uuid not null references schools (id) on delete cascade,
  type activity_type not null,
  occurred_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb,
  note text,
  photo_path text,
  approved boolean not null default true,
  batch_id uuid,                                        -- one teacher entry logged for many children
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index activities_child_time on activities (child_id, occurred_at desc);
create index activities_school_time on activities (school_id, occurred_at desc);

create table shifts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  classroom_id uuid references classrooms (id) on delete set null,
  profile_id uuid not null references profiles (id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz
);

create table certifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  expires_on date,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  child_id uuid not null references children (id) on delete cascade,   -- one thread per child
  sender_id uuid not null references profiles (id),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_child_time on messages (child_id, created_at);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  kind announcement_kind not null default 'info',
  title text not null,
  body text not null,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table billing_plans (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  child_id uuid not null references children (id) on delete cascade,
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  frequency bill_frequency not null default 'monthly',
  next_bill_date date not null,
  due_days integer not null default 7,
  -- [{ "profile_id": uuid, "percent": 50 }, ...]; empty = one invoice with no specific payer
  split jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  child_id uuid not null references children (id) on delete cascade,
  plan_id uuid references billing_plans (id) on delete set null,
  payer_id uuid references profiles (id) on delete set null,
  description text not null,
  amount_cents integer not null check (amount_cents >= 0),
  issued_on date not null default current_date,
  due_on date not null,
  status invoice_status not null default 'open',
  paid_at timestamptz,
  paid_method text,
  created_at timestamptz not null default now()
);
-- A recurring plan bills each payer at most once per billing date (manual invoices are unrestricted).
create unique index invoices_plan_once on invoices
  (plan_id, issued_on, coalesce(payer_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where plan_id is not null;

create table cameras (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  classroom_id uuid references classrooms (id) on delete set null,  -- null = common area / playground
  name text not null,
  stream_url text not null,                            -- HLS (.m3u8) URL; never readable by families directly
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- When families may watch a camera. No windows = camera is never visible to families.
create table video_windows (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid not null references cameras (id) on delete cascade,
  days smallint[] not null default '{1,2,3,4,5}',      -- 0 = Sunday … 6 = Saturday
  start_time time not null default '08:00',
  end_time time not null default '17:00',
  check (end_time > start_time)
);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  school_id uuid not null references schools (id) on delete cascade,
  role invite_role not null,
  email text,
  child_id uuid references children (id) on delete cascade,
  relationship text,
  access guardian_access not null default 'full',
  created_by uuid references profiles (id),
  accepted_by uuid references profiles (id),
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now(),
  check (role <> 'guardian' or child_id is not null)
);

-- ───────────────────── Access helper functions ─────────────────────
create or replace function safe_uuid(p text) returns uuid
language plpgsql immutable as $$
begin return p::uuid; exception when others then return null; end;
$$;

-- security definer so policies can consult membership tables without recursive RLS.

create or replace function is_org_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_owners where org_id = p_org and profile_id = auth.uid());
$$;

-- 'owner' | 'director' | 'teacher' | null
create or replace function school_role(p_school uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select 'owner' from schools s join org_owners o on o.org_id = s.org_id
       where s.id = p_school and o.profile_id = auth.uid() limit 1),
    (select role::text from school_staff where school_id = p_school and profile_id = auth.uid())
  );
$$;

create or replace function is_staff(p_school uuid) returns boolean
language sql stable as $$ select school_role(p_school) is not null; $$;

create or replace function is_admin(p_school uuid) returns boolean
language sql stable as $$ select school_role(p_school) in ('owner', 'director'); $$;

create or replace function child_school(p_child uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select school_id from children where id = p_child;
$$;

-- Any guardian link (including video-only sub-users such as grandparents).
create or replace function is_guardian(p_child uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from guardians where child_id = p_child and profile_id = auth.uid());
$$;

-- Full guardians see reports, billing and messages; video-only sub-users do not.
create or replace function is_full_guardian(p_child uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from guardians
                 where child_id = p_child and profile_id = auth.uid() and access = 'full');
$$;

create or replace function is_family_of_school(p_school uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from guardians g join children c on c.id = g.child_id
                 where c.school_id = p_school and g.profile_id = auth.uid());
$$;

-- Can the current user see this person's name? (colleagues, families of my school, my child's staff)
create or replace function can_see_profile(p_profile uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_profile = auth.uid()
    or exists (  -- I'm staff at a school where they are staff or a guardian
      select 1 from schools s
      where school_role(s.id) is not null and (
        exists (select 1 from school_staff ss where ss.school_id = s.id and ss.profile_id = p_profile)
        or exists (select 1 from org_owners o where o.org_id = s.org_id and o.profile_id = p_profile)
        or exists (select 1 from guardians g join children c on c.id = g.child_id
                   where c.school_id = s.id and g.profile_id = p_profile)))
    or exists (  -- I'm a guardian and they are staff at my child's school or a co-guardian
      select 1 from guardians mine join children c on c.id = mine.child_id
      where mine.profile_id = auth.uid() and (
        exists (select 1 from school_staff ss where ss.school_id = c.school_id and ss.profile_id = p_profile)
        or exists (select 1 from schools s join org_owners o on o.org_id = s.org_id
                   where s.id = c.school_id and o.profile_id = p_profile)
        or exists (select 1 from guardians g where g.child_id = c.id and g.profile_id = p_profile)));
$$;

-- ───────────────────────────── RLS ─────────────────────────────
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table org_owners enable row level security;
alter table schools enable row level security;
alter table school_staff enable row level security;
alter table classrooms enable row level security;
alter table children enable row level security;
alter table guardians enable row level security;
alter table pickups enable row level security;
alter table attendance enable row level security;
alter table activities enable row level security;
alter table shifts enable row level security;
alter table certifications enable row level security;
alter table messages enable row level security;
alter table announcements enable row level security;
alter table billing_plans enable row level security;
alter table invoices enable row level security;
alter table cameras enable row level security;
alter table video_windows enable row level security;
alter table invitations enable row level security;

create policy profiles_read on profiles for select using (can_see_profile(id));
create policy profiles_update_self on profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy orgs_read on organizations for select
  using (is_org_owner(id) or exists (select 1 from schools s where s.org_id = organizations.id and (is_staff(s.id) or is_family_of_school(s.id))));
create policy orgs_update on organizations for update using (is_org_owner(id));

create policy org_owners_read on org_owners for select using (profile_id = auth.uid() or is_org_owner(org_id));

create policy schools_read on schools for select using (is_staff(id) or is_family_of_school(id));
create policy schools_insert on schools for insert with check (is_org_owner(org_id));
create policy schools_update on schools for update using (is_admin(id)) with check (is_admin(id));
create policy schools_delete on schools for delete using (is_org_owner(org_id));

create policy staff_read on school_staff for select using (is_staff(school_id) or profile_id = auth.uid());
create policy staff_write on school_staff for all using (is_admin(school_id)) with check (is_admin(school_id));

create policy classrooms_read on classrooms for select using (is_staff(school_id) or is_family_of_school(school_id));
create policy classrooms_write on classrooms for all using (is_admin(school_id)) with check (is_admin(school_id));

create policy children_read on children for select using (is_staff(school_id) or is_guardian(id));
create policy children_write on children for all using (is_admin(school_id)) with check (is_admin(school_id));

create policy guardians_read on guardians for select
  using (profile_id = auth.uid() or is_staff(child_school(child_id)) or is_full_guardian(child_id));
create policy guardians_write on guardians for all
  using (is_admin(child_school(child_id))) with check (is_admin(child_school(child_id)));

create policy pickups_read on pickups for select using (is_staff(child_school(child_id)) or is_full_guardian(child_id));
create policy pickups_write on pickups for all
  using (is_admin(child_school(child_id)) or is_full_guardian(child_id))
  with check (is_admin(child_school(child_id)) or is_full_guardian(child_id));

create policy attendance_read on attendance for select using (is_staff(school_id) or is_full_guardian(child_id));
create policy attendance_write on attendance for all
  using (is_staff(school_id)) with check (is_staff(school_id) and child_school(child_id) = school_id);

create policy activities_read on activities for select
  using (is_staff(school_id) or (approved and is_full_guardian(child_id)));
create policy activities_write on activities for all
  using (is_staff(school_id)) with check (is_staff(school_id) and child_school(child_id) = school_id);

create policy shifts_read on shifts for select using (is_staff(school_id));
create policy shifts_write on shifts for all
  using (is_admin(school_id) or (profile_id = auth.uid() and is_staff(school_id)))
  with check (is_admin(school_id) or (profile_id = auth.uid() and is_staff(school_id)));

create policy certs_read on certifications for select using (is_staff(school_id));
create policy certs_write on certifications for all
  using (is_admin(school_id) or (profile_id = auth.uid() and is_staff(school_id)))
  with check (is_admin(school_id) or (profile_id = auth.uid() and is_staff(school_id)));

create policy messages_read on messages for select using (is_staff(school_id) or is_full_guardian(child_id));
create policy messages_insert on messages for insert
  with check (sender_id = auth.uid() and child_school(child_id) = school_id
              and (is_staff(school_id) or is_full_guardian(child_id)));

create policy announcements_read on announcements for select using (is_staff(school_id) or is_family_of_school(school_id));
create policy announcements_write on announcements for all using (is_admin(school_id)) with check (is_admin(school_id));

create policy plans_read on billing_plans for select using (is_admin(school_id) or is_full_guardian(child_id));
create policy plans_write on billing_plans for all using (is_admin(school_id)) with check (is_admin(school_id));

-- Teachers deliberately cannot see billing.
create policy invoices_read on invoices for select using (is_admin(school_id) or is_full_guardian(child_id));
create policy invoices_write on invoices for all using (is_admin(school_id)) with check (is_admin(school_id));

-- Families never read cameras directly: they go through my_video_feeds(), which enforces the schedule.
create policy cameras_admin on cameras for all using (is_admin(school_id)) with check (is_admin(school_id));
create policy windows_admin on video_windows for all
  using (exists (select 1 from cameras c where c.id = camera_id and is_admin(c.school_id)))
  with check (exists (select 1 from cameras c where c.id = camera_id and is_admin(c.school_id)));

create policy invites_read on invitations for select using (is_admin(school_id) or created_by = auth.uid());
-- Admins invite anyone; a full guardian may invite a video-only sub-user (grandparent etc.) for their own child.
create policy invites_insert on invitations for insert with check (
  created_by = auth.uid() and (
    is_admin(school_id)
    or (role = 'guardian' and access = 'video_only' and is_full_guardian(child_id) and child_school(child_id) = school_id)));
create policy invites_delete on invitations for delete using (is_admin(school_id) or created_by = auth.uid());

-- ───────────────────────────── RPCs ─────────────────────────────

-- Camera feeds the current family member may watch right now, evaluated in the school's timezone.
create or replace function my_video_feeds()
returns table (camera_id uuid, camera_name text, classroom_name text, child_id uuid, stream_url text, window_ends time)
language sql stable security definer set search_path = public as $$
  select distinct on (cam.id, c.id) cam.id, cam.name, cr.name, c.id, cam.stream_url, w.end_time
  from guardians g
  join children c on c.id = g.child_id and c.status = 'enrolled'
  join schools s on s.id = c.school_id
  join cameras cam on cam.school_id = s.id and cam.active
       and (cam.classroom_id is null or cam.classroom_id = c.classroom_id)
  left join classrooms cr on cr.id = cam.classroom_id
  join video_windows w on w.camera_id = cam.id
  where g.profile_id = auth.uid()
    and g.video_approved
    and extract(dow from (now() at time zone s.timezone))::smallint = any (w.days)
    and (now() at time zone s.timezone)::time >= w.start_time
    and (now() at time zone s.timezone)::time < w.end_time
  order by cam.id, c.id, w.end_time desc;
$$;

-- Schedule summary for families (no URLs) so they can see when video is available.
create or replace function my_video_schedule()
returns table (camera_name text, classroom_name text, days smallint[], start_time time, end_time time, approved boolean)
language sql stable security definer set search_path = public as $$
  select distinct cam.name, cr.name, w.days, w.start_time, w.end_time, g.video_approved
  from guardians g
  join children c on c.id = g.child_id and c.status = 'enrolled'
  join cameras cam on cam.school_id = c.school_id and cam.active
       and (cam.classroom_id is null or cam.classroom_id = c.classroom_id)
  left join classrooms cr on cr.id = cam.classroom_id
  join video_windows w on w.camera_id = cam.id
  where g.profile_id = auth.uid();
$$;

-- Read an invitation by token before signing up (no other columns leak).
create or replace function invitation_preview(p_token text)
returns table (school_name text, role invite_role, child_first_name text, email text, expired boolean, accepted boolean)
language sql stable security definer set search_path = public as $$
  select s.name, i.role, c.first_name, i.email, i.expires_at < now(), i.accepted_at is not null
  from invitations i join schools s on s.id = i.school_id
  left join children c on c.id = i.child_id
  where i.token = p_token;
$$;

-- Accept an invitation as the signed-in user.
create or replace function accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from invitations where token = p_token for update;
  if not found then raise exception 'invitation not found'; end if;
  if inv.accepted_at is not null then raise exception 'invitation already used'; end if;
  if inv.expires_at < now() then raise exception 'invitation expired'; end if;
  if inv.email is not null and lower(inv.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'this invitation was sent to a different email address';
  end if;

  if inv.role = 'guardian' then
    insert into guardians (child_id, profile_id, relationship, access, video_approved)
    values (inv.child_id, auth.uid(), coalesce(inv.relationship, 'parent'), inv.access, false)
    on conflict (child_id, profile_id) do update set access = excluded.access, relationship = excluded.relationship;
  else
    insert into school_staff (school_id, profile_id, role)
    values (inv.school_id, auth.uid(), inv.role::text::staff_role)
    on conflict (school_id, profile_id) do update set role = excluded.role;
  end if;

  update invitations set accepted_by = auth.uid(), accepted_at = now() where id = inv.id;
  return inv.school_id;
end;
$$;

-- Create a new organization + first school. Server-only (service role), called by the owner sign-up flow.
create or replace function create_organization(p_owner uuid, p_org_name text, p_school_name text, p_timezone text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_school uuid;
begin
  insert into organizations (name) values (p_org_name) returning id into v_org;
  insert into org_owners (org_id, profile_id) values (v_org, p_owner);
  insert into schools (org_id, name, timezone) values (v_org, p_school_name, coalesce(p_timezone, 'America/Los_Angeles'))
    returning id into v_school;
  return v_school;
end;
$$;
revoke execute on function create_organization(uuid, text, text, text) from public, anon, authenticated;
grant execute on function create_organization(uuid, text, text, text) to service_role;

-- Keep a profile row for every auth user.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ───────────────────────────── Storage ─────────────────────────────
-- Private bucket; object path = <school_id>/<child_id>/<file>.
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;

create policy media_staff_all on storage.objects for all
  using (bucket_id = 'media' and is_staff(safe_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'media' and is_staff(safe_uuid((storage.foldername(name))[1])));

create policy media_family_read on storage.objects for select
  using (bucket_id = 'media'
         and is_full_guardian(safe_uuid((storage.foldername(name))[2]))
         and exists (select 1 from activities a where a.photo_path = storage.objects.name and a.approved));

-- ───────────────────────────── Realtime ─────────────────────────────
alter publication supabase_realtime add table messages;
