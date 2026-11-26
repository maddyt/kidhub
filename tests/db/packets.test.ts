// Row-level security for the Packet Generator (0003_packets.sql).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, as, addUser, type Db } from './harness.ts';

const U = {
  teachA: '00000000-0000-0000-0000-00000000001a',
  teachB: '00000000-0000-0000-0000-00000000001b',
  parentA: '00000000-0000-0000-0000-00000000001c',
  stranger: '00000000-0000-0000-0000-00000000001d',
};
const ORG = '11000000-0000-0000-0000-000000000001';
const SA = '21000000-0000-0000-0000-000000000001';
const SB = '21000000-0000-0000-0000-000000000002';
const KID_A = '41000000-0000-0000-0000-000000000001';

let db: Db;
let reqId: string;

before(async () => {
  db = await freshDb();
  for (const [k, id] of Object.entries(U)) await addUser(db, id, k);
  await db.exec(`
    insert into organizations (id, name) values ('${ORG}', 'Test Org');
    insert into schools (id, org_id, name, timezone) values
      ('${SA}', '${ORG}', 'School A', 'UTC'), ('${SB}', '${ORG}', 'School B', 'UTC');
    insert into school_staff values ('${SA}', '${U.teachA}', 'teacher'), ('${SB}', '${U.teachB}', 'teacher');
    insert into children (id, school_id, first_name, last_name) values ('${KID_A}', '${SA}', 'Ava', 'A');
    insert into guardians (child_id, profile_id, access, video_approved) values ('${KID_A}', '${U.parentA}', 'full', true);
  `);
});

test('a teacher can create and read a packet request for their own school', async () => {
  await as(db, U.teachA, async (q) => {
    const ins = await q(
      `insert into packet_requests (school_id, requested_by, topic, developmental_plane) values ($1, $2, 'Parts of a bee', 'primary_3_6') returning id`,
      [SA, U.teachA]);
    reqId = ins.rows[0].id;
    const { rows } = await q('select * from packet_requests where id = $1', [reqId]);
    assert.equal(rows.length, 1);
  });
});

test('a teacher at a different school cannot see or create packets for School A', async () => {
  await as(db, U.teachB, async (q) => {
    assert.equal((await q('select * from packet_requests')).rows.length, 0);
    await assert.rejects(q(
      `insert into packet_requests (school_id, requested_by, topic, developmental_plane) values ($1, $2, 'x', 'primary_3_6')`,
      [SA, U.teachB]));
  });
});

test('a stranger sees nothing and cannot insert', async () => {
  await as(db, U.stranger, async (q) => {
    assert.equal((await q('select * from packet_requests')).rows.length, 0);
    await assert.rejects(q(
      `insert into packet_requests (school_id, requested_by, topic, developmental_plane) values ($1, $2, 'x', 'primary_3_6')`,
      [SA, U.stranger]));
  });
});

test('a full guardian can create and read a packet for their own child, scoped to that child', async () => {
  await as(db, U.parentA, async (q) => {
    const ins = await q(
      `insert into packet_requests (school_id, child_id, requested_by, topic, developmental_plane) values ($1, $2, $3, 'Why do leaves change color?', 'lower_elementary_6_9') returning id`,
      [SA, KID_A, U.parentA]);
    const { rows } = await q('select * from packet_requests where id = $1', [ins.rows[0].id]);
    assert.equal(rows.length, 1);
    // Cannot create one for a child that isn't theirs, even naming the right school.
    await assert.rejects(q(
      `insert into packet_requests (school_id, requested_by, topic, developmental_plane) values ($1, $2, 'x', 'primary_3_6')`,
      [SB, U.parentA]));
  });
});

test('school_id is pinned: a request cannot be moved to another school', async () => {
  await as(db, U.teachA, async (q) => {
    await assert.rejects(q('update packet_requests set school_id = $1 where id = $2', [SB, reqId]));
  });
});

test('packet_assets inherit visibility from their packet_requests row', async () => {
  let assetId = '';
  await as(db, U.teachA, async (q) => {
    const ins = await q(`insert into packet_assets (request_id, term_name, kind) values ($1, 'Deck', 'base') returning id`, [reqId]);
    assetId = ins.rows[0].id;
  });
  await as(db, U.teachB, async (q) => {
    assert.equal((await q('select * from packet_assets where id = $1', [assetId])).rows.length, 0);
  });
  await as(db, U.teachA, async (q) => {
    assert.equal((await q('select * from packet_assets where id = $1', [assetId])).rows.length, 1);
  });
});
