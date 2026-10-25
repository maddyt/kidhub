-- KidHub Phase 1 security hardening. Run AFTER 0001_kidhub.sql.
-- Paste the whole file into the Supabase SQL editor and Run. Safe to run once.
--
-- 1. Two-step verification (MFA) enforced in the database for staff
-- 2. Audit log of sensitive changes (append-only)
-- 3. Rate limiting store for sign-in, sign-up and invitation endpoints
-- 4. Camera URLs no longer returned to families (the server issues short-lived playback links)
-- 5. Invitations must be locked to an email address

-- ───────────────────────── 1. MFA enforcement ─────────────────────────
-- A user who has turned on two-step verification gets no staff access from a session that
-- skipped it (aal1), even when calling the API directly instead of going through the app.
create or replace function mfa_ok() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status::text = 'verified');
$$;

create or replace function is_org_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select mfa_ok() and exists (select 1 from org_owners where org_id = p_org and profile_id = auth.uid());
$$;

create or replace function school_role(p_school uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when not mfa_ok() then null else coalesce(
    (select 'owner' from schools s join org_owners o on o.org_id = s.org_id
       where s.id = p_school and o.profile_id = auth.uid() limit 1),
    (select role::text from school_staff where school_id = p_school and profile_id = auth.uid())
  ) end;
$$;

-- ───────────────────────── 2. Audit log ─────────────────────────
create table if not exists audit_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,                 -- null = system (cron, seed)
  school_id uuid,             -- no foreign key: history outlives deleted rows
  entity text not null,
  action text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  detail text
);
create index if not exists audit_events_school_at on audit_events (school_id, at desc);
alter table audit_events enable row level security;
drop policy if exists audit_read on audit_events;
create policy audit_read on audit_events for select using (school_id is not null and is_admin(school_id));
revoke insert, update, delete, truncate on audit_events from anon, authenticated;

create or replace function audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb := to_jsonb(coalesce(new, old));
  v_school uuid;
begin
  v_school := coalesce(
    safe_uuid(j ->> 'school_id'),
    child_school(safe_uuid(j ->> 'child_id')),
    (select c.school_id from cameras c where c.id = safe_uuid(j ->> 'camera_id')));
  -- Rows removed by a cascade (e.g. deleting a whole school) have nothing left to attribute them to.
  if v_school is null and tg_op = 'DELETE' then return old; end if;
  insert into audit_events (actor, school_id, entity, action, entity_id, old_data, new_data)
  values (auth.uid(), v_school, tg_table_name, lower(tg_op), coalesce(j ->> 'id', j ->> 'child_id'),
          case when tg_op <> 'INSERT' then to_jsonb(old) - 'token' end,
          case when tg_op <> 'DELETE' then to_jsonb(new) - 'token' end);
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['children', 'guardians', 'pickups', 'attendance', 'invoices', 'billing_plans',
                            'school_staff', 'cameras', 'video_windows', 'invitations', 'schools', 'classrooms'] loop
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function audit_trigger()', t);
  end loop;
end $$;

-- App-level events that are not row changes (e.g. someone watched a camera).
create or replace function log_event(p_school uuid, p_entity text, p_action text, p_entity_id text, p_detail text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not (is_staff(p_school) or is_family_of_school(p_school)) then
    raise exception 'not allowed';
  end if;
  insert into audit_events (actor, school_id, entity, action, entity_id, detail)
  values (auth.uid(), p_school, left(p_entity, 40), left(p_action, 40), left(p_entity_id, 80), left(p_detail, 500));
end;
$$;

-- ───────────────────────── 3. Rate limiting ─────────────────────────
create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null
);
alter table rate_limits enable row level security;   -- no policies: server (service role) only

-- Counts a hit for `p_key`; returns false once more than `p_max` hits land within `p_window_seconds`.
create or replace function rate_limit_hit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hits integer;
begin
  insert into rate_limits as r (key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
    window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  if random() < 0.01 then delete from rate_limits where window_start < now() - interval '1 day'; end if;
  return v_hits <= p_max;
end;
$$;
revoke execute on function rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function rate_limit_hit(text, integer, integer) to service_role;

-- ───────────────────────── 4. Camera URLs stay on the server ─────────────────────────
drop function if exists my_video_feeds();
create function my_video_feeds()
returns table (camera_id uuid, camera_name text, classroom_name text, child_id uuid, school_id uuid, window_ends time)
language sql stable security definer set search_path = public as $$
  select distinct on (cam.id, c.id) cam.id, cam.name, cr.name, c.id, s.id, w.end_time
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

-- ───────────────────────── 5. Email-locked invitations ─────────────────────────
-- New invitations need an email (existing rows are left alone; accepting one without an email now fails).
alter table invitations drop constraint if exists invitations_email_required;
alter table invitations add constraint invitations_email_required check (email is not null) not valid;

create or replace function accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from invitations where token = p_token for update;
  if not found then raise exception 'invitation not found'; end if;
  if inv.accepted_at is not null then raise exception 'invitation already used'; end if;
  if inv.expires_at < now() then raise exception 'invitation expired'; end if;
  if inv.email is null then raise exception 'this invitation link is out of date; ask the school for a new one'; end if;
  if lower(inv.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
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

-- ───────────────────────── Performance indexes used by the policies above ─────────────────────────
create index if not exists guardians_profile on guardians (profile_id);
create index if not exists school_staff_profile on school_staff (profile_id);
create index if not exists attendance_school_day on attendance (school_id, day);
create index if not exists invoices_school_status on invoices (school_id, status, due_on);

-- ───────────────────────── Account deletion ─────────────────────────
-- Deleting a person's account (e.g. a privacy request) must not be blocked by records they touched.
-- Those records stay (the school needs them) and show "former user" instead of a name.
alter table messages alter column sender_id drop not null;
do $$
declare r record;
begin
  for r in select * from (values
    ('invitations', 'created_by'), ('invitations', 'accepted_by'), ('attendance', 'check_in_by'),
    ('attendance', 'check_out_by'), ('activities', 'created_by'), ('announcements', 'created_by'),
    ('messages', 'sender_id')) as t(tbl, col)
  loop
    execute format('alter table %1$I drop constraint if exists %1$s_%2$s_fkey', r.tbl, r.col);
    execute format('alter table %1$I add constraint %1$s_%2$s_fkey foreign key (%2$I) references profiles (id) on delete set null', r.tbl, r.col);
  end loop;
end $$;
