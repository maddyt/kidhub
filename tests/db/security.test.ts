// Phase 1 security controls from 0002_security.sql.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, addUser, type Db } from './harness.ts';

const DIR = '00000000-0000-0000-0000-0000000000d1';
const TEACH = '00000000-0000-0000-0000-0000000000d2';
const PARENT = '00000000-0000-0000-0000-0000000000d3';
const ORG = '10000000-0000-0000-0000-0000000000d1';
const SCHOOL = '20000000-0000-0000-0000-0000000000d1';
const KID = '40000000-0000-0000-0000-0000000000d1';
let db: Db;

before(async () => {
  db = await freshDb();
  for (const [id, n] of [[DIR, 'Dir'], [TEACH, 'Teach'], [PARENT, 'Parent']]) await addUser(db, id, n);
  await db.exec(`
    insert into organizations (id, name) values ('${ORG}', 'O');
    insert into schools (id, org_id, name, timezone) values ('${SCHOOL}', '${ORG}', 'S', 'UTC');
    insert into school_staff values ('${SCHOOL}', '${DIR}', 'director'), ('${SCHOOL}', '${TEACH}', 'teacher');
    insert into children (id, school_id, first_name, last_name) values ('${KID}', '${SCHOOL}', 'Kai', 'K');
    insert into guardians (child_id, profile_id) values ('${KID}', '${PARENT}');
  `);
});

test('every table in public has row-level security on', async () => {
  const { rows } = await db.query<any>(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  assert.deepEqual(rows.map((r) => r.relname), []);
});

test('a staff member with two-step verification on gets no access until they complete it', async () => {
  await as(db, DIR, async (q) => assert.equal((await q('select * from children')).rows.length, 1));
  await db.query(`insert into auth.mfa_factors (user_id, status) values ($1, 'verified')`, [DIR]);
  await as(db, DIR, async (q) => {
    assert.equal((await q('select * from children')).rows.length, 0, 'aal1 session is locked out');
    await assert.rejects(q(`update children set first_name = 'X' where id = $1 returning id`, [KID]).then((r) => { if (!r.rows.length) throw new Error('no rows'); }));
  });
  await as(db, DIR, async (q) => assert.equal((await q('select * from children')).rows.length, 1), undefined, 'aal2');
  // An unverified (half-finished) enrollment doesn't lock anyone out.
  await db.query(`insert into auth.mfa_factors (user_id, status) values ($1, 'unverified')`, [TEACH]);
  await as(db, TEACH, async (q) => assert.equal((await q('select * from children')).rows.length, 1));
});

test('sensitive changes are audited with the actor, and only admins can read the log', async () => {
  // Teachers can't add pickups (RLS), so the attempt fails and nothing is audited.
  await as(db, TEACH, (q) => assert.rejects(q(`insert into pickups (child_id, name) values ($1, 'Uncle Bob')`, [KID])));
  assert.equal((await db.query(`select 1 from audit_events where entity = 'pickups'`)).rows.length, 0);
  await as(db, DIR, (q) => q(`insert into pickups (child_id, name) values ($1, 'Aunt Ann')`, [KID]), undefined, 'aal2');
  const audit = (await db.query<any>(`select actor, school_id, action, new_data from audit_events where entity = 'pickups'`)).rows;
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor, DIR);
  assert.equal(audit[0].school_id, SCHOOL);
  assert.equal(audit[0].new_data.name, 'Aunt Ann');

  await as(db, TEACH, async (q) => assert.equal((await q('select * from audit_events')).rows.length, 0));
  await as(db, PARENT, async (q) => assert.equal((await q('select * from audit_events')).rows.length, 0));
  await as(db, DIR, async (q) => assert.ok((await q('select * from audit_events')).rows.length >= 2), undefined, 'aal2');
  await as(db, DIR, (q) => assert.rejects(q(`delete from audit_events`), /permission denied/), undefined, 'aal2');
  await as(db, DIR, (q) => assert.rejects(q(`update audit_events set action = 'x'`), /permission denied/), undefined, 'aal2');
  assert.ok(((await db.query<any>('select count(*)::int n from audit_events')).rows[0].n) >= 2, 'log is append-only');
});

test('invitation tokens are never copied into the audit log', async () => {
  await db.query(`insert into invitations (school_id, role, email) values ($1, 'teacher', 'x@test')`, [SCHOOL]);
  const { rows } = await db.query<any>(`select new_data from audit_events where entity = 'invitations'`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].new_data.token, undefined);
  assert.equal(rows[0].new_data.email, 'x@test');
});

test('log_event records app events for people at the school only', async () => {
  await as(db, PARENT, (q) => q(`select log_event($1, 'camera', 'view', 'cam-1', 'watched')`, [SCHOOL]));
  const outsider = '00000000-0000-0000-0000-0000000000d9';
  await addUser(db, outsider, 'Out');
  await as(db, outsider, (q) => assert.rejects(q(`select log_event($1, 'camera', 'view', 'x', 'y')`, [SCHOOL])));
  const { rows } = await db.query<any>(`select actor from audit_events where entity = 'camera'`);
  assert.deepEqual(rows.map((r) => r.actor), [PARENT]);
});

test('rate limiter allows up to the max per window and is server-only', async () => {
  const hit = async () => (await db.query<any>(`select rate_limit_hit('login:1.2.3.4', 3, 60) ok`)).rows[0].ok;
  assert.deepEqual([await hit(), await hit(), await hit(), await hit()], [true, true, true, false]);
  await db.query(`update rate_limits set window_start = now() - interval '2 minutes' where key = 'login:1.2.3.4'`);
  assert.equal(await hit(), true, 'window resets');
  await as(db, PARENT, (q) => assert.rejects(q(`select rate_limit_hit('x', 1, 60)`), /permission denied/));
  await as(db, PARENT, async (q) => assert.equal((await q('select * from rate_limits')).rows.length, 0));
});

test('new invitations must be locked to an email; old email-less ones cannot be accepted', async () => {
  await assert.rejects(db.query(`insert into invitations (school_id, role) values ($1, 'teacher')`, [SCHOOL]), /invitations_email_required/);
  // Simulate an invitation created before this migration.
  await db.exec(`alter table invitations drop constraint invitations_email_required`);
  const { rows } = await db.query<any>(`insert into invitations (school_id, role) values ($1, 'teacher') returning token`, [SCHOOL]);
  await db.exec(`alter table invitations add constraint invitations_email_required check (email is not null) not valid`);
  await as(db, PARENT, (q) => assert.rejects(q('select accept_invitation($1)', [rows[0].token]), /out of date/));
});

test('a person can be deleted even after they took part in records; the records remain', async () => {
  const gone = '00000000-0000-0000-0000-0000000000e1';
  await addUser(db, gone, 'Leaver');
  await db.query(`insert into guardians (child_id, profile_id) values ($1, $2)`, [KID, gone]);
  await as(db, gone, (q) => q(`insert into messages (school_id, child_id, sender_id, body) values ($1, $2, $3, 'bye')`, [SCHOOL, KID, gone]));
  await db.query(`insert into invitations (school_id, role, email, accepted_by, created_by) values ($1, 'teacher', 'z@test', $2, $2)`, [SCHOOL, gone]);
  await db.query(`delete from auth.users where id = $1`, [gone]);
  const { rows } = await db.query<any>(`select sender_id from messages where body = 'bye'`);
  assert.deepEqual(rows, [{ sender_id: null }]);
});
