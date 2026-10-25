// Runs the real migration inside PGlite (in-process Postgres) with a minimal stand-in for
// the parts of Supabase it depends on: the auth schema, JWT-derived auth.uid(), API roles,
// the storage schema and the realtime publication.
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync } from 'node:fs';

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated, service_role;
create publication supabase_realtime;
`;

const GRANTS = `
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on storage.objects to authenticated, service_role;
`;

export async function freshDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);
  const sql = readFileSync(new URL('../../supabase/migrations/0001_kidhub.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(GRANTS);
  return db;
}

export type Db = Awaited<ReturnType<typeof freshDb>>;

/** Run `fn` as an authenticated user (RLS applies), like a request carrying that user's JWT. */
export async function as<T>(db: Db, userId: string | null, fn: (q: Db['query']) => Promise<T>, email?: string): Promise<T> {
  const claims = userId ? JSON.stringify({ sub: userId, email: email ?? `${userId}@test`, role: 'authenticated' }) : '';
  await db.exec(`set role ${userId ? 'authenticated' : 'anon'}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  try {
    return await fn(db.query.bind(db));
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

export async function addUser(db: Db, id: string, name: string) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,
    [id, `${name.toLowerCase()}@test`, JSON.stringify({ full_name: name })]);
}
