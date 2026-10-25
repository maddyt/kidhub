// Row-level security tests: each scenario runs as a specific signed-in user against the real migration.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, addUser, type Db } from './harness.ts';

const U = {
  owner: '00000000-0000-0000-0000-00000000000a',
  dirA: '00000000-0000-0000-0000-00000000000b',
  teachA: '00000000-0000-0000-0000-00000000000c',
  parentA: '00000000-0000-0000-0000-00000000000d',
  parentB: '00000000-0000-0000-0000-00000000000e',
  grandma: '00000000-0000-0000-0000-00000000000f',
  stranger: '00000000-0000-0000-0000-000000000010',
};
const ORG = '10000000-0000-0000-0000-000000000001';
const SA = '20000000-0000-0000-0000-00000000000a';
const SB = '20000000-0000-0000-0000-00000000000b';
const ROOM_A = '30000000-0000-0000-0000-00000000000a';
const KID_A = '40000000-0000-0000-0000-00000000000a';
const KID_B = '40000000-0000-0000-0000-00000000000b';
const CAM_A = '50000000-0000-0000-0000-00000000000a';

let db: Db;

before(async () => {
  db = await freshDb();
  for (const [k, id] of Object.entries(U)) await addUser(db, id, k);
  await db.exec(`
    insert into organizations (id, name) values ('${ORG}', 'Test Org');
    insert into org_owners values ('${ORG}', '${U.owner}');
    insert into schools (id, org_id, name, timezone) values
      ('${SA}', '${ORG}', 'School A', 'UTC'), ('${SB}', '${ORG}', 'School B', 'UTC');
    insert into school_staff values ('${SA}', '${U.dirA}', 'director'), ('${SA}', '${U.teachA}', 'teacher');
    insert into classrooms (id, school_id, name) values ('${ROOM_A}', '${SA}', 'Room A');
    insert into children (id, school_id, classroom_id, first_name, last_name) values
      ('${KID_A}', '${SA}', '${ROOM_A}', 'Ava', 'A'), ('${KID_B}', '${SB}', null, 'Ben', 'B');
    insert into guardians (child_id, profile_id, access, video_approved) values
      ('${KID_A}', '${U.parentA}', 'full', true),
      ('${KID_B}', '${U.parentB}', 'full', true),
      ('${KID_A}', '${U.grandma}', 'video_only', false);
    insert into activities (child_id, school_id, type, approved, note) values
      ('${KID_A}', '${SA}', 'meal', true, 'ate lunch'),
      ('${KID_A}', '${SA}', 'photo', false, 'pending photo'),
      ('${KID_B}', '${SB}', 'meal', true, 'B lunch');
    insert into invoices (school_id, child_id, description, amount_cents, due_on) values
      ('${SA}', '${KID_A}', 'Tuition A', 120000, current_date),
      ('${SB}', '${KID_B}', 'Tuition B', 120000, current_date);
    insert into cameras (id, school_id, classroom_id, name, stream_url) values
      ('${CAM_A}', '${SA}', '${ROOM_A}', 'Room A cam', 'https://example.test/a.m3u8');
    insert into video_windows (camera_id, days, start_time, end_time) values
      ('${CAM_A}', '{0,1,2,3,4,5,6}', '00:00', '23:59:59.999');
  `);
});

const ids = (rows: any[]) => rows.map((r) => r.id).sort();

test('anonymous users see nothing', async () => {
  await as(db, null, async (q) => {
    assert.equal((await q('select * from children')).rows.length, 0);
    assert.equal((await q('select * from schools')).rows.length, 0);
    assert.equal((await q('select * from invoices')).rows.length, 0);
  });
});

test('owner sees every school in the org; director only their own', async () => {
  await as(db, U.owner, async (q) => {
    assert.deepEqual(ids((await q('select id from schools')).rows), [SA, SB]);
    assert.equal((await q('select * from children')).rows.length, 2);
  });
  await as(db, U.dirA, async (q) => {
    assert.deepEqual(ids((await q('select id from schools')).rows), [SA]);
    assert.deepEqual(ids((await q('select id from children')).rows), [KID_A]);
  });
});

test('parents see only their own child, activity and invoices', async () => {
  await as(db, U.parentA, async (q) => {
    assert.deepEqual(ids((await q('select id from children')).rows), [KID_A]);
    const acts = (await q<any>('select note from activities')).rows.map((r) => r.note);
    assert.deepEqual(acts, ['ate lunch'], 'unapproved photo and other school activity are hidden');
    assert.deepEqual((await q<any>('select description from invoices')).rows.map((r) => r.description), ['Tuition A']);
  });
});

test('families can never read camera URLs directly', async () => {
  await as(db, U.parentA, async (q) => {
    assert.equal((await q('select * from cameras')).rows.length, 0);
  });
});

test('video feed requires center approval and an open window', async () => {
  await as(db, U.parentA, async (q) => {
    const feeds = (await q<any>('select * from my_video_feeds()')).rows;
    assert.equal(feeds.length, 1);
    assert.equal(feeds[0].camera_id, CAM_A);
    assert.equal(feeds[0].stream_url, undefined, 'the camera URL never leaves the server');
  });
  await as(db, U.grandma, async (q) => {
    assert.equal((await q('select * from my_video_feeds()')).rows.length, 0, 'not yet approved');
  });
  await db.exec(`update guardians set video_approved = true where profile_id = '${U.grandma}'`);
  await as(db, U.grandma, async (q) => {
    assert.equal((await q('select * from my_video_feeds()')).rows.length, 1, 'approved');
  });
  await db.exec(`update video_windows set days = '{}' where camera_id = '${CAM_A}'`);
  await as(db, U.parentA, async (q) => {
    assert.equal((await q('select * from my_video_feeds()')).rows.length, 0, 'outside window');
  });
  await db.exec(`update video_windows set days = '{0,1,2,3,4,5,6}' where camera_id = '${CAM_A}'`);
  await as(db, U.parentB, async (q) => {
    assert.equal((await q('select * from my_video_feeds()')).rows.length, 0, 'other school camera');
  });
});

test('video-only sub-users cannot see reports, billing or messages', async () => {
  await as(db, U.grandma, async (q) => {
    assert.equal((await q('select * from activities')).rows.length, 0);
    assert.equal((await q('select * from invoices')).rows.length, 0);
    assert.equal((await q('select * from messages')).rows.length, 0);
  });
});

test('teachers log activity at their school only, and cannot see billing', async () => {
  await as(db, U.teachA, async (q) => {
    await q(`insert into activities (child_id, school_id, type) values ($1, $2, 'diaper')`, [KID_A, SA]);
    await assert.rejects(q(`insert into activities (child_id, school_id, type) values ($1, $2, 'diaper')`, [KID_B, SB]));
    await assert.rejects(q(`insert into activities (child_id, school_id, type) values ($1, $2, 'diaper')`, [KID_B, SA]),
      'child/school mismatch is rejected');
    assert.equal((await q('select * from invoices')).rows.length, 0);
    assert.equal((await q('select * from cameras')).rows.length, 0);
  });
});

test('parents cannot write activities or attendance', async () => {
  await as(db, U.parentA, async (q) => {
    await assert.rejects(q(`insert into activities (child_id, school_id, type) values ($1, $2, 'note')`, [KID_A, SA]));
    await assert.rejects(q(`insert into attendance (child_id, school_id, day) values ($1, $2, current_date)`, [KID_A, SA]));
  });
});

test('messages: parents post only to their own child thread, as themselves', async () => {
  await as(db, U.parentA, async (q) => {
    await q(`insert into messages (school_id, child_id, sender_id, body) values ($1, $2, $3, 'hi')`, [SA, KID_A, U.parentA]);
    await assert.rejects(q(`insert into messages (school_id, child_id, sender_id, body) values ($1, $2, $3, 'hi')`, [SB, KID_B, U.parentA]));
    await assert.rejects(q(`insert into messages (school_id, child_id, sender_id, body) values ($1, $2, $3, 'spoof')`, [SA, KID_A, U.teachA]));
  });
  await as(db, U.teachA, async (q) => {
    assert.equal((await q('select * from messages')).rows.length, 1);
  });
  await as(db, U.parentB, async (q) => {
    assert.equal((await q('select * from messages')).rows.length, 0);
  });
});

test('profiles: names visible only to people who share a school', async () => {
  await as(db, U.parentA, async (q) => {
    const seen = ids((await q('select id from profiles')).rows);
    assert.ok(seen.includes(U.teachA) && seen.includes(U.owner) && seen.includes(U.grandma));
    assert.ok(!seen.includes(U.parentB) && !seen.includes(U.stranger));
  });
  await as(db, U.stranger, async (q) => {
    assert.deepEqual(ids((await q('select id from profiles')).rows), [U.stranger]);
  });
});

test('invitations: guardians may only invite video-only sub-users for their own child', async () => {
  await as(db, U.parentA, async (q) => {
    const ins = (school: string, role: string, child: string | null, access: string) =>
      q(`insert into invitations (school_id, role, child_id, access, created_by, email) values ($1, $2, $3, $4, $5, 'g@test')`, [school, role, child, access, U.parentA]);
    await ins(SA, 'guardian', KID_A, 'video_only');
    await assert.rejects(ins(SA, 'guardian', KID_A, 'full'));
    await assert.rejects(ins(SA, 'teacher', null, 'full'));
    await assert.rejects(ins(SB, 'guardian', KID_B, 'video_only'));
  });
});

test('accepting an invitation links the account, once, and respects the invited email', async () => {
  const { rows } = await db.query<any>(
    `insert into invitations (school_id, role, child_id, email, created_by) values ($1, 'guardian', $2, 'stranger@test', $3) returning token`,
    [SA, KID_A, U.dirA]);
  const token = rows[0].token;
  await as(db, U.parentB, (q) => assert.rejects(q('select accept_invitation($1)', [token]), /different email/));
  await as(db, U.stranger, async (q) => {
    await q('select accept_invitation($1)', [token]);
    assert.deepEqual(ids((await q('select id from children')).rows), [KID_A]);
    const g = (await q<any>('select video_approved from guardians where profile_id = $1', [U.stranger])).rows[0];
    assert.equal(g.video_approved, false, 'video needs center approval');
  }, 'stranger@test');
  await as(db, U.stranger, (q) => assert.rejects(q('select accept_invitation($1)', [token]), /already used/), 'stranger@test');
});

test('staff invitation grants the school role', async () => {
  const { rows } = await db.query<any>(
    `insert into invitations (school_id, role, created_by, email) values ($1, 'teacher', $2, 'grandma@test') returning token`, [SB, U.owner]);
  await as(db, U.grandma, async (q) => {
    await q('select accept_invitation($1)', [rows[0].token]);
    assert.ok(ids((await q('select id from schools')).rows).includes(SB));
  }, 'grandma@test');
});

test('create_organization is server-only', async () => {
  await as(db, U.stranger, (q) =>
    assert.rejects(q(`select create_organization($1, 'x', 'y', 'UTC')`, [U.stranger]), /permission denied/));
});

test('storage: staff manage their school media; families read only approved photos of their child', async () => {
  const approved = `${SA}/${KID_A}/approved.jpg`;
  const pending = `${SA}/${KID_A}/pending.jpg`;
  await db.query(`insert into storage.objects (bucket_id, name) values ('media', $1), ('media', $2)`, [approved, pending]);
  await db.query(`insert into activities (child_id, school_id, type, photo_path, approved) values ($1, $2, 'photo', $3, true), ($1, $2, 'photo', $4, false)`,
    [KID_A, SA, approved, pending]);
  await as(db, U.teachA, async (q) => {
    assert.equal((await q(`select name from storage.objects`)).rows.length, 2);
    await q(`insert into storage.objects (bucket_id, name) values ('media', $1)`, [`${SA}/${KID_A}/new.jpg`]);
    await assert.rejects(q(`insert into storage.objects (bucket_id, name) values ('media', $1)`, [`${SB}/${KID_B}/x.jpg`]));
  });
  await as(db, U.parentA, async (q) => {
    assert.deepEqual((await q<any>(`select name from storage.objects`)).rows.map((r) => r.name), [approved]);
  });
  await as(db, U.parentB, async (q) => {
    assert.equal((await q(`select name from storage.objects`)).rows.length, 0);
  });
});
