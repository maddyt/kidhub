-- KidHub Packet Generator. Run AFTER 0001_kidhub.sql and 0002_security.sql.
-- Paste the whole file into the Supabase SQL editor and Run. Safe to run once.
--
-- Lets a teacher or a full guardian turn a curiosity question ("Parts of a honeybee") into a
-- printable Montessori packet: an AI-drafted curriculum manifest (vocabulary, a short story,
-- a hands-on Control of Error activity) compiled into a print-ready PDF. See docs/PACKET-GENERATOR.md.
--
-- This does not depend on the curriculum library proposed in docs/PRD-MONTESSORI.md (not yet built):
-- `subject_category` here is a freestanding label, chosen to match that doc's curriculum areas so a
-- future `lesson_id` column can be added without renaming anything.

create type packet_status as enum ('draft', 'manifest_ready', 'compiled', 'failed');
create type packet_plane as enum ('primary_3_6', 'lower_elementary_6_9', 'upper_elementary_9_12');
create type packet_subject as enum (
  'geography', 'botany', 'zoology', 'anatomy', 'physics', 'language',
  'practical_life', 'mathematics', 'cultural', 'sensorial'
);

create table packet_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools (id) on delete cascade,
  child_id uuid references children (id) on delete set null,     -- optional: packet made with a specific child in mind
  requested_by uuid references profiles (id) on delete set null,
  topic text not null check (length(topic) between 1 and 200),
  developmental_plane packet_plane not null,
  subject_category packet_subject not null default 'cultural',
  status packet_status not null default 'draft',
  manifest jsonb,              -- validated PacketManifest once Subsystem A succeeds (src/lib/domain/packets.ts)
  pdf_path text,                -- storage object path once compiled
  page_count integer,
  error text,                   -- last failure, shown to the requester
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index packet_requests_school_time on packet_requests (school_id, created_at desc);
create index packet_requests_child_time on packet_requests (child_id, created_at desc) where child_id is not null;

-- One row per vocabulary term's illustration, once an image-generation provider is configured
-- (src/lib/images/provider.ts). Empty for every packet until then; the PDF compiler renders
-- text-only cards (label strips, definition cards, the story and activity sheet) without them.
create table packet_assets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references packet_requests (id) on delete cascade,
  term_name text not null,
  kind text not null check (kind in ('base', 'highlight')),
  image_path text,
  vlm_pass boolean,
  vlm_notes text,
  attempt smallint not null default 1,
  created_at timestamptz not null default now()
);
create index packet_assets_request on packet_assets (request_id);

-- school_id is the RLS boundary for this table; pin it so a request can never be moved between
-- schools (RLS's WITH CHECK alone can't see the pre-update row to compare against).
create or replace function touch_packet_request() returns trigger
language plpgsql set search_path = public as $$ begin
  if new.school_id <> old.school_id then raise exception 'packet_requests.school_id cannot change'; end if;
  new.updated_at := now();
  return new;
end; $$;
create trigger packet_requests_touch before update on packet_requests
  for each row execute function touch_packet_request();

-- ───────────────────────────── RLS ─────────────────────────────
alter table packet_requests enable row level security;
alter table packet_assets enable row level security;

-- A full guardian may request and read packets tied to their own child; staff see their school's.
create policy packets_read on packet_requests for select using (
  is_staff(school_id) or (child_id is not null and is_full_guardian(child_id))
);
create policy packets_insert on packet_requests for insert with check (
  requested_by = auth.uid()
  and (is_staff(school_id) or (child_id is not null and is_full_guardian(child_id) and child_school(child_id) = school_id))
);
-- The requester (while the pipeline runs under their own session) or any staff member of the school
-- can update a request's status/manifest/pdf_path. school_id itself is pinned by the trigger above.
create policy packets_update on packet_requests for update using (
  requested_by = auth.uid() or is_staff(school_id)
) with check (
  requested_by = auth.uid() or is_staff(school_id)
);
create policy packets_delete on packet_requests for delete using (requested_by = auth.uid() or is_staff(school_id));

create policy packet_assets_read on packet_assets for select using (
  exists (select 1 from packet_requests r where r.id = request_id
          and (is_staff(r.school_id) or (r.child_id is not null and is_full_guardian(r.child_id))))
);
create policy packet_assets_write on packet_assets for all using (
  exists (select 1 from packet_requests r where r.id = request_id and (r.requested_by = auth.uid() or is_staff(r.school_id)))
) with check (
  exists (select 1 from packet_requests r where r.id = request_id and (r.requested_by = auth.uid() or is_staff(r.school_id)))
);

-- Audit every status/manifest change like the rest of the schema (0002_security.sql pattern).
drop trigger if exists audit_packet_requests on packet_requests;
create trigger audit_packet_requests after insert or update or delete on packet_requests
  for each row execute function audit_trigger();

-- ───────────────────────────── Storage ─────────────────────────────
-- Private bucket; object path = <school_id>/<request_id>/<file>, same convention as the 'media' bucket.
insert into storage.buckets (id, name, public) values ('packets', 'packets', false) on conflict (id) do nothing;

create policy packets_storage_staff on storage.objects for all
  using (bucket_id = 'packets' and is_staff(safe_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'packets' and is_staff(safe_uuid((storage.foldername(name))[1])));

create policy packets_storage_family_read on storage.objects for select using (
  bucket_id = 'packets'
  and exists (
    select 1 from packet_requests r
    where r.id = safe_uuid((storage.foldername(name))[2])
      and r.child_id is not null and is_full_guardian(r.child_id)
  )
);
