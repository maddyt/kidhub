import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayIn, dayBounds, offsetMinutes, ageLabel, addDays } from '../src/lib/domain/time.ts';
import { careTimers, careState, isNapping } from '../src/lib/domain/care.ts';
import { ratioStatus } from '../src/lib/domain/ratios.ts';
import { dailyReport, describe, formatDuration } from '../src/lib/domain/report.ts';
import { nextBillDate, splitAmount, billingDatesDue, parseMoney, money } from '../src/lib/domain/billing.ts';
import { describeWindow } from '../src/lib/domain/video.ts';
import { buildAlerts, type Snapshot } from '../src/lib/domain/alerts.ts';

test('dayIn respects the school timezone', () => {
  const t = new Date('2026-03-10T05:30:00Z');
  assert.equal(dayIn('UTC', t), '2026-03-10');
  assert.equal(dayIn('America/Los_Angeles', t), '2026-03-09');
});

test('dayBounds gives the UTC span of a local day, including DST transitions', () => {
  const { start, end } = dayBounds('2026-07-01', 'America/Los_Angeles');
  assert.equal(start.toISOString(), '2026-07-01T07:00:00.000Z');
  assert.equal(end.toISOString(), '2026-07-02T07:00:00.000Z');
  const dst = dayBounds('2026-03-08', 'America/New_York'); // spring forward: 23h day
  assert.equal(dst.start.toISOString(), '2026-03-08T05:00:00.000Z');
  assert.equal(dst.end.toISOString(), '2026-03-09T04:00:00.000Z');
  assert.equal(offsetMinutes('Asia/Kolkata', new Date()), 330);
});

test('ageLabel', () => {
  assert.equal(ageLabel('2025-12-15', '2026-10-25'), '10 mo');
  assert.equal(ageLabel('2023-04-01', '2026-10-25'), '3 yrs 6 mo');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('care timers start at check-in and go due → overdue', () => {
  assert.equal(careState(50, 120), 'ok');
  assert.equal(careState(100, 120), 'due');
  assert.equal(careState(121, 120), 'overdue');
  const checkIn = '2026-10-25T15:00:00.000Z';
  const now = new Date('2026-10-25T17:30:00.000Z');
  const intervals = { diaper_interval_min: 120, bottle_interval_min: 180 };
  const none = careTimers([], checkIn, intervals, now);
  assert.deepEqual(none.map((t) => [t.kind, t.minutesSince, t.state]), [['diaper', 150, 'overdue'], ['bottle', 150, 'due']]);
  const changed = careTimers([{ type: 'diaper', occurred_at: '2026-10-25T17:00:00.000Z' }], checkIn, intervals, now);
  assert.equal(changed[0].state, 'ok');
  assert.equal(changed[0].minutesSince, 30);
  // Entries before today's check-in don't count; classrooms without intervals get no timers.
  assert.equal(careTimers([{ type: 'diaper', occurred_at: '2026-10-24T17:00:00.000Z' }], checkIn, intervals, now)[0].lastAt, null);
  assert.deepEqual(careTimers([], checkIn, { diaper_interval_min: null, bottle_interval_min: null }, now), []);
});

test('isNapping follows the latest nap event', () => {
  assert.equal(isNapping([{ type: 'nap_start', occurred_at: '2026-01-01T10:00:00Z' }]), true);
  assert.equal(isNapping([{ type: 'nap_start', occurred_at: '2026-01-01T10:00:00Z' }, { type: 'nap_end', occurred_at: '2026-01-01T11:00:00Z' }]), false);
});

test('ratio compliance', () => {
  assert.deepEqual(ratioStatus(9, 2, 4), { children: 9, staff: 2, ratio: 4, requiredStaff: 3, ok: false });
  assert.equal(ratioStatus(8, 2, 4).ok, true);
  assert.equal(ratioStatus(0, 0, 4).ok, true);
});

test('daily report is built from logged entries', () => {
  const acts = [
    { id: '1', type: 'nap_start', occurred_at: '2026-10-25T19:00:00Z', note: null, details: {} },
    { id: '2', type: 'nap_end', occurred_at: '2026-10-25T20:30:00Z', note: null, details: {} },
    { id: '3', type: 'bottle', occurred_at: '2026-10-25T16:00:00Z', note: null, details: { ounces: 5 } },
    { id: '4', type: 'bottle', occurred_at: '2026-10-25T18:00:00Z', note: null, details: { ounces: '4' } },
    { id: '5', type: 'meal', occurred_at: '2026-10-25T17:00:00Z', note: 'Loved it', details: { meal_type: 'lunch', amount: 'all', food: 'pasta' } },
    { id: '6', type: 'diaper', occurred_at: '2026-10-25T17:30:00Z', note: null, details: { kind: 'wet' } },
  ];
  const r = dailyReport(acts, 'UTC');
  assert.deepEqual(r.summary, { meals: 1, bottles: 2, bottleOz: 9, diapers: 1, napMinutes: 90, photos: 0 });
  assert.deepEqual(r.timeline.map((t) => t.id), ['3', '5', '6', '4', '1', '2']);
  assert.equal(r.timeline[1].label, 'Lunch ate all (pasta)');
  assert.equal(r.timeline[0].time, '4:00 PM');
  assert.equal(formatDuration(90), '1h 30m');
  assert.equal(describe({ type: 'diaper', details: { kind: 'BM' } }), 'Diaper · BM');
});

test('monthly billing clamps to month end; weekly adds 7 days', () => {
  assert.equal(nextBillDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(nextBillDate('2026-12-15', 'monthly'), '2027-01-15');
  assert.equal(nextBillDate('2026-10-25', 'weekly'), '2026-11-01');
});

test('split payers always sum exactly to the invoice amount', () => {
  assert.deepEqual(splitAmount(100001, [{ profile_id: 'a', percent: 50 }, { profile_id: 'b', percent: 50 }]).map((x) => x.cents), [50001, 50000]);
  const thirds = splitAmount(100000, [{ profile_id: 'a', percent: 1 }, { profile_id: 'b', percent: 1 }, { profile_id: 'c', percent: 1 }]);
  assert.equal(thirds.reduce((s, x) => s + x.cents, 0), 100000);
  assert.deepEqual(splitAmount(5000, []), [{ profile_id: null, cents: 5000 }]);
});

test('billingDatesDue catches up missed cycles', () => {
  const r = billingDatesDue({ id: 'p', next_bill_date: '2026-08-01', frequency: 'monthly' }, '2026-10-25');
  assert.deepEqual(r, { dates: ['2026-08-01', '2026-09-01', '2026-10-01'], next: '2026-11-01' });
  assert.deepEqual(billingDatesDue({ id: 'p', next_bill_date: '2026-11-01', frequency: 'monthly' }, '2026-10-25').dates, []);
});

test('money parsing and formatting', () => {
  assert.equal(parseMoney('$1,250.50'), 125050);
  assert.equal(parseMoney('abc'), null);
  assert.equal(money(125050), '$1,250.50');
});

test('video windows read naturally', () => {
  assert.equal(describeWindow({ days: [1, 2, 3, 4, 5], start_time: '08:00:00', end_time: '17:30:00' }), 'Weekdays 8am–5:30pm');
});

test('alerts cover safety, care, billing, compliance and approvals', () => {
  const now = new Date('2026-10-25T19:00:00Z'); // noon in Los Angeles
  const s: Snapshot = {
    now,
    schools: [{ id: 's', name: 'S', timezone: 'America/Los_Angeles', closes_at: '18:00:00' }],
    classrooms: [{ id: 'r', school_id: 's', name: 'Infants', ratio: 4, diaper_interval_min: 120, bottle_interval_min: null }],
    children: [1, 2, 3, 4, 5].map((i) => ({ id: `c${i}`, school_id: 's', classroom_id: 'r', first_name: `Kid${i}`, last_name: 'X' })),
    openAttendance: [
      ...[1, 2, 3, 4, 5].map((i) => ({ child_id: `c${i}`, school_id: 's', day: '2026-10-25', check_in_at: '2026-10-25T15:00:00Z' })),
      { child_id: 'c1', school_id: 's', day: '2026-10-24', check_in_at: '2026-10-24T15:00:00Z' },
    ],
    activitiesToday: [2, 3, 4, 5].map((i) => ({ child_id: `c${i}`, type: 'diaper', occurred_at: '2026-10-25T18:30:00Z' })),
    openShifts: [{ profile_id: 't', school_id: 's', classroom_id: 'r' }],
    openInvoices: [
      { id: 'i1', school_id: 's', child_id: 'c2', amount_cents: 100000, due_on: '2026-10-01' },
      { id: 'i2', school_id: 's', child_id: 'c3', amount_cents: 100000, due_on: '2026-11-01' },
    ],
    certifications: [
      { id: 'x1', school_id: 's', staff_name: 'Ana', name: 'CPR', expires_on: '2026-10-01' },
      { id: 'x2', school_id: 's', staff_name: 'Bo', name: 'First Aid', expires_on: '2026-11-10' },
      { id: 'x3', school_id: 's', staff_name: 'Cy', name: 'CPR', expires_on: '2027-06-01' },
    ],
    pendingPhotos: [{ school_id: 's', count: 2 }],
    pendingVideoApprovals: [{ school_id: 's', child_id: 'c4', guardian_name: 'Grandma' }],
  };
  const ids = buildAlerts(s).map((a) => a.id);
  assert.deepEqual(ids.sort(), [
    'care:diaper:c1', 'cert:x1', 'cert:x2', 'checkout:c1:2026-10-24', 'overdue:c2', 'photos:s', 'ratio:r', 'video:c4:Grandma',
  ].sort());
  assert.equal(buildAlerts(s)[0].severity, 'critical');
});
