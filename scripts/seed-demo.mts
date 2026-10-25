// Creates (or recreates) the fictional "Little Oaks Learning" demo: two schools, staff, families,
// a realistic day of check-ins and care entries, invoices, cameras and messages.
// Usage: npm run seed:demo        (reads .env.local; safe to re-run, it replaces the demo org)
//        npm run seed:demo -- --remove   (deletes the demo org and demo accounts)
import { createClient } from '@supabase/supabase-js';
import { DEMO_ACCOUNTS } from '../src/lib/demo.ts';
import { dayIn, dayBounds, addDays } from '../src/lib/domain/time.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, password = process.env.DEMO_PASSWORD;
if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
if (!password || password.length < 8) throw new Error('Set DEMO_PASSWORD (8+ characters) in .env.local');

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const ORG = 'Little Oaks Learning (demo)';
const TZ = 'America/Los_Angeles';
const EXTRA_STAFF = [
  { email: 'maria.demo@example.com', name: 'Maria Lopez' },
  { email: 'sam.demo@example.com', name: 'Sam Patel' },
  { email: 'jordan.demo@example.com', name: 'Jordan Lee' }, // a parent awaiting video approval
];

function check<T>(r: { data: T; error: any }, what: string): NonNullable<T> {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as NonNullable<T>;
}

async function removeDemo() {
  const { data: orgs } = await db.from('organizations').select('id').eq('name', ORG);
  for (const o of orgs ?? []) check(await db.from('organizations').delete().eq('id', o.id), 'delete org');
  const emails = new Set([...DEMO_ACCOUNTS.map((a) => a.email), ...EXTRA_STAFF.map((s) => s.email)]);
  for (let page = 1; page < 20; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    for (const u of users) if (u.email && emails.has(u.email)) await db.auth.admin.deleteUser(u.id);
    if (users.length < 1000) break;
  }
}

async function user(email: string, full_name: string, pw: string) {
  const r = await db.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name } });
  if (r.error || !r.data.user) throw new Error(`create ${email}: ${r.error?.message}`);
  await db.from('profiles').update({ full_name }).eq('id', r.data.user.id);
  return r.data.user.id;
}

/** A small illustrated "photo" (SVG) so the demo has pictures without shipping real children's photos. */
function drawing(hue: number, label: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
<rect width="800" height="600" fill="hsl(${hue} 70% 92%)"/><circle cx="640" cy="120" r="70" fill="#F6C343"/>
<rect x="120" y="330" width="120" height="120" rx="8" fill="hsl(${hue} 65% 55%)"/><rect x="250" y="330" width="120" height="120" rx="8" fill="hsl(${(hue + 120) % 360} 65% 55%)"/>
<rect x="185" y="200" width="120" height="120" rx="8" fill="hsl(${(hue + 240) % 360} 65% 55%)"/><rect y="450" width="800" height="150" fill="#8BC48A"/>
<text x="400" y="560" font-family="sans-serif" font-size="36" text-anchor="middle" fill="#1F4D41">${label}</text></svg>`;
}

async function main() {
  await removeDemo();
  if (process.argv.includes('--remove')) { console.log('Demo removed.'); return; }

  const now = new Date();
  const today = dayIn(TZ, now);
  const ago = (min: number) => new Date(now.getTime() - min * 60000).toISOString();
  const dayStart = dayBounds(today, TZ).start.getTime();
  // Clamp "minutes ago" so nothing lands before today's local midnight, whatever time the seed runs.
  const agoToday = (min: number) => new Date(Math.max(dayStart + 60000, now.getTime() - min * 60000)).toISOString();

  const id: Record<string, string> = {};
  for (const a of DEMO_ACCOUNTS) id[a.key] = await user(a.email, a.name, password!);
  for (const s of EXTRA_STAFF) id[s.email] = await user(s.email, s.name, crypto.randomUUID());

  const maple = check(await db.rpc('create_organization', { p_owner: id.owner, p_org_name: ORG, p_school_name: 'Maple Street campus', p_timezone: TZ }), 'org') as string;
  const { data: org } = await db.from('schools').select('org_id').eq('id', maple).single();
  check(await db.from('schools').update({ address: '120 Maple St', require_photo_approval: true }).eq('id', maple), 'school');
  const river = check(await db.from('schools').insert({ org_id: org!.org_id, name: 'Riverside campus', timezone: TZ, address: '45 River Rd' }).select('id').single(), 'school 2').id;

  check(await db.from('school_staff').insert([
    { school_id: maple, profile_id: id.director, role: 'director' },
    { school_id: maple, profile_id: id.teacher, role: 'teacher' },
    { school_id: maple, profile_id: id['maria.demo@example.com'], role: 'teacher' },
    { school_id: river, profile_id: id['sam.demo@example.com'], role: 'director' },
  ]), 'staff');

  const rooms = check(await db.from('classrooms').insert([
    { school_id: maple, name: 'Infants', age_group: 'infant', ratio: 4, capacity: 8, diaper_interval_min: 120, bottle_interval_min: 180 },
    { school_id: maple, name: 'Toddlers', age_group: 'toddler', ratio: 6, capacity: 12, diaper_interval_min: 150 },
    { school_id: maple, name: 'Preschool', age_group: 'preschool', ratio: 10, capacity: 20 },
    { school_id: river, name: 'Toddlers', age_group: 'toddler', ratio: 6, capacity: 12, diaper_interval_min: 150 },
    { school_id: river, name: 'Pre-K', age_group: 'preschool', ratio: 10, capacity: 20 },
  ]).select('id, school_id, name'), 'classrooms');
  const room = (school: string, name: string) => rooms.find((r) => r.school_id === school && r.name === name)!.id;

  const yearsAgo = (y: number, m = 0) => addDays(today, -Math.round(y * 365 + m * 30.4));
  const kidRows = [
    // Maple Infants
    ['Aarav', 'Shah', maple, room(maple, 'Infants'), yearsAgo(0, 9), null],
    ['Leo', 'Martinez', maple, room(maple, 'Infants'), yearsAgo(0, 7), null],
    ['Nora', 'Kim', maple, room(maple, 'Infants'), yearsAgo(0, 11), 'Dairy (formula only)'],
    ['Eli', 'Johnson', maple, room(maple, 'Infants'), yearsAgo(1, 1), null],
    // Maple Toddlers
    ...['Ava Brooks', 'Mateo Garcia', 'Zoe Chen', 'Liam Walker', 'Isla Patel', 'Noah Rivera', 'Maya Thompson'].map((n, i) =>
      [n.split(' ')[0], n.split(' ')[1], maple, room(maple, 'Toddlers'), yearsAgo(1, 6 + i), i === 2 ? 'Peanuts (EpiPen in office)' : null]),
    // Maple Preschool
    ['Mira', 'Shah', maple, room(maple, 'Preschool'), yearsAgo(4, 2), null],
    ...['Owen Davis', 'Lucy Nguyen', 'Ezra Cohen', 'Hazel Wright', 'Kai Robinson'].map((n, i) =>
      [n.split(' ')[0], n.split(' ')[1], maple, room(maple, 'Preschool'), yearsAgo(3, 4 + i), i === 1 ? 'Eggs' : null]),
    // Riverside
    ...['Ruby Scott', 'Theo Adams', 'Ivy Baker', 'Felix Hall', 'Luna Young'].map((n, i) =>
      [n.split(' ')[0], n.split(' ')[1], river, room(river, 'Toddlers'), yearsAgo(1, 8 + i), null]),
    ...['Jack Allen', 'Stella King', 'Miles Green', 'Aria Hill', 'Ezekiel Moore', 'Clara Lewis'].map((n, i) =>
      [n.split(' ')[0], n.split(' ')[1], river, room(river, 'Pre-K'), yearsAgo(4, i), null]),
  ] as const;
  const kids = check(await db.from('children').insert(kidRows.map(([first_name, last_name, school_id, classroom_id, birth_date, allergies]) => ({
    first_name, last_name, school_id, classroom_id, birth_date, allergies, status: 'enrolled', start_date: addDays(today, -200),
    medical_notes: allergies?.startsWith('Peanuts') ? 'Epinephrine auto-injector in the front office. Call parent after use.' : null,
  }))).select('id, first_name, last_name, school_id, classroom_id'), 'children');
  const kid = (first: string, last: string) => kids.find((k) => k.first_name === first && k.last_name === last)!;
  const aarav = kid('Aarav', 'Shah'), mira = kid('Mira', 'Shah'), zoe = kid('Zoe', 'Chen');

  check(await db.from('children').insert([
    { school_id: maple, first_name: 'Henry', last_name: 'Ortiz', status: 'waitlist', classroom_id: room(maple, 'Infants'), birth_date: yearsAgo(0, 3) },
    { school_id: maple, first_name: 'Willow', last_name: 'Price', status: 'waitlist', classroom_id: room(maple, 'Toddlers'), birth_date: yearsAgo(1, 4) },
    { school_id: river, first_name: 'Oscar', last_name: 'Reed', status: 'waitlist', classroom_id: room(river, 'Pre-K'), birth_date: yearsAgo(3, 9) },
  ]), 'waitlist');

  check(await db.from('guardians').insert([
    { child_id: aarav.id, profile_id: id.parent, relationship: 'mother', access: 'full', video_approved: true },
    { child_id: mira.id, profile_id: id.parent, relationship: 'mother', access: 'full', video_approved: true },
    { child_id: aarav.id, profile_id: id.grandparent, relationship: 'grandfather', access: 'video_only', video_approved: true },
    { child_id: zoe.id, profile_id: id['jordan.demo@example.com'], relationship: 'father', access: 'full', video_approved: false },
  ]), 'guardians');
  check(await db.from('pickups').insert([
    { child_id: aarav.id, name: 'Raj Shah', relationship: 'father', phone: '(555) 201-3344', can_pickup: true, is_emergency_contact: true },
    { child_id: mira.id, name: 'Raj Shah', relationship: 'father', phone: '(555) 201-3344', can_pickup: true, is_emergency_contact: true },
    { child_id: mira.id, name: 'Anita Desai', relationship: 'aunt', phone: '(555) 410-9921', can_pickup: false, is_emergency_contact: true },
    { child_id: zoe.id, name: 'Wei Chen', relationship: 'mother', phone: '(555) 777-1200', can_pickup: true, is_emergency_contact: true },
  ]), 'pickups');

  // Attendance: most children are in. One Toddler was never checked out yesterday (an alert to resolve).
  const present = kids.filter((_, i) => i % 7 !== 6);
  check(await db.from('attendance').insert(present.map((k, i) => ({
    child_id: k.id, school_id: k.school_id, day: today, check_in_at: agoToday(240 - (i % 5) * 15), check_in_by: id.teacher,
    dropped_off_by: k.id === aarav.id || k.id === mira.id ? 'Priya Shah' : null,
  }))), 'attendance');
  const liam = kid('Liam', 'Walker');
  check(await db.from('attendance').insert({ child_id: liam.id, school_id: maple, day: addDays(today, -1),
    check_in_at: new Date(dayBounds(addDays(today, -1), TZ).start.getTime() + 8 * 3.6e6).toISOString(), check_in_by: id.teacher }), 'stale attendance');

  // Shifts: Infants covered; Toddlers has 7 children but only one teacher (1:6) → ratio alert.
  check(await db.from('shifts').insert([
    { school_id: maple, profile_id: id.teacher, classroom_id: room(maple, 'Infants'), clock_in_at: agoToday(250) },
    { school_id: maple, profile_id: id['maria.demo@example.com'], classroom_id: room(maple, 'Toddlers'), clock_in_at: agoToday(250) },
    { school_id: maple, profile_id: id.director, classroom_id: null, clock_in_at: agoToday(260) },
    { school_id: river, profile_id: id['sam.demo@example.com'], classroom_id: room(river, 'Pre-K'), clock_in_at: agoToday(250) },
  ]), 'shifts');

  // Upload two illustrated "photos".
  const upload = async (child: { id: string; school_id: string }, hue: number, label: string) => {
    const path = `${child.school_id}/${child.id}/${crypto.randomUUID()}.svg`;
    check(await db.storage.from('media').upload(path, new Blob([drawing(hue, label)], { type: 'image/svg+xml' }), { contentType: 'image/svg+xml' }), 'upload');
    return path;
  };
  const photo1 = await upload(aarav, 150, 'Tummy time with blocks!');
  const photo2 = await upload(mira, 30, 'Building a tower');
  const photoPending = await upload(mira, 260, 'Art time (awaiting approval)');

  const act = (child: { id: string; school_id: string }, type: string, min: number, details: object = {}, note: string | null = null, extra: object = {}) =>
    ({ child_id: child.id, school_id: child.school_id, type, occurred_at: agoToday(min), details, note, created_by: id.teacher, ...extra });
  const leo = kid('Leo', 'Martinez'), nora = kid('Nora', 'Kim'), eli = kid('Eli', 'Johnson');
  check(await db.from('activities').insert([
    act(aarav, 'bottle', 200, { ounces: 5, contents: 'breast milk' }),
    act(aarav, 'diaper', 190, { kind: 'wet' }),
    act(aarav, 'nap_start', 150), act(aarav, 'nap_end', 95),
    act(aarav, 'photo', 80, {}, 'Tummy time with blocks!', { photo_path: photo1 }),
    act(aarav, 'diaper', 60, { kind: 'BM' }),
    act(aarav, 'bottle', 45, { ounces: 4, contents: 'breast milk' }),
    act(aarav, 'observation', 30, { domain: 'gross motor' }, 'Rolled from tummy to back twice on his own!'),
    act(leo, 'bottle', 170, { ounces: 6, contents: 'formula' }), act(leo, 'diaper', 165, { kind: 'wet' }), // diaper overdue
    act(nora, 'bottle', 120, { ounces: 5, contents: 'formula' }), act(nora, 'diaper', 70, { kind: 'wet' }), act(nora, 'nap_start', 25),
    act(eli, 'meal', 140, { meal_type: 'am snack', amount: 'most', food: 'banana, puffs' }), act(eli, 'diaper', 100, { kind: 'wet + BM' }),
    act(mira, 'meal', 180, { meal_type: 'breakfast', amount: 'all', food: 'oatmeal, berries' }),
    act(mira, 'potty', 120, { kind: 'success' }),
    act(mira, 'photo', 90, {}, 'Mira built the tallest tower in class today.', { photo_path: photo2 }),
    act(mira, 'photo', 40, {}, 'Painting with watercolors', { photo_path: photoPending, approved: false }),
    act(mira, 'observation', 35, { domain: 'language' }, 'Retold "The Very Hungry Caterpillar" in order to her friends.'),
    act(mira, 'meal', 20, { meal_type: 'lunch', amount: 'some', food: 'pasta, peas' }),
    ...present.filter((k) => k.classroom_id === room(maple, 'Toddlers')).map((k, i) => act(k, 'diaper', 60 + i * 10, { kind: 'wet' })),
  ]), 'activities');

  check(await db.from('messages').insert([
    { school_id: maple, child_id: aarav.id, sender_id: id.parent, body: 'Morning! Aarav was up a lot last night, so he may want an early nap.', created_at: agoToday(230) },
    { school_id: maple, child_id: aarav.id, sender_id: id.teacher, body: 'Thanks for letting us know! He went down at 9:30 and slept nearly an hour.', created_at: agoToday(90) },
    { school_id: maple, child_id: mira.id, sender_id: id.director, body: 'Reminder: Mira’s class field trip form is due Friday.', created_at: agoToday(300) },
  ]), 'messages');

  check(await db.from('announcements').insert([
    { school_id: maple, kind: 'info', title: 'Picture day is Friday', body: 'Photographers arrive at 9am. Order forms are in your child’s cubby.', created_by: id.director },
    { school_id: maple, kind: 'closure', title: 'Closed Monday for staff training', body: 'Both campuses are closed next Monday for CPR recertification.', created_by: id.owner },
    { school_id: river, kind: 'closure', title: 'Closed Monday for staff training', body: 'Both campuses are closed next Monday for CPR recertification.', created_by: id.owner },
  ]), 'announcements');

  // Billing: monthly plans; last month mostly paid on time, a few overdue.
  const first = (offsetMonths: number) => { const d = new Date(`${today.slice(0, 7)}-01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + offsetMonths); return d.toISOString().slice(0, 10); };
  const tuition = (k: { classroom_id: string | null }) => {
    const n = rooms.find((r) => r.id === k.classroom_id)?.name;
    return n === 'Infants' ? 185000 : n === 'Toddlers' ? 160000 : 135000;
  };
  check(await db.from('billing_plans').insert(kids.map((k) => ({
    school_id: k.school_id, child_id: k.id, description: 'Monthly tuition', amount_cents: tuition(k), frequency: 'monthly', next_bill_date: first(1), due_days: 5,
  }))), 'plans');
  const overdue = new Set([kid('Owen', 'Davis').id, kid('Felix', 'Hall').id, kid('Noah', 'Rivera').id]);
  const invoices = kids.flatMap((k, i) => [-2, -1, 0].map((m) => {
    const issued = first(m), due = addDays(issued, 5);
    const unpaid = m === 0 ? (due >= today || overdue.has(k.id)) : (m === -1 && k.id === kid('Felix', 'Hall').id);
    const late = i % 6 === 0;
    return {
      school_id: k.school_id, child_id: k.id, description: `Monthly tuition (${issued})`, amount_cents: tuition(k), issued_on: issued, due_on: due,
      status: unpaid ? 'open' : 'paid', paid_at: unpaid ? null : `${addDays(due, late ? 4 : -1)}T17:00:00Z`, paid_method: unpaid ? null : i % 3 ? 'ACH' : 'card',
    };
  }));
  check(await db.from('invoices').insert(invoices), 'invoices');

  check(await db.from('certifications').insert([
    { school_id: maple, profile_id: id.teacher, name: 'Pediatric CPR', expires_on: addDays(today, 20) },
    { school_id: maple, profile_id: id.teacher, name: 'First Aid', expires_on: addDays(today, 300) },
    { school_id: maple, profile_id: id.director, name: 'Director credential', expires_on: addDays(today, 500) },
    { school_id: maple, profile_id: id['maria.demo@example.com'], name: 'Pediatric CPR', expires_on: addDays(today, 180) },
    { school_id: river, profile_id: id['sam.demo@example.com'], name: 'First Aid', expires_on: addDays(today, -12) },
  ]), 'certs');

  // Public test streams stand in for classroom cameras. Demo windows are always open.
  const cams = check(await db.from('cameras').insert([
    { school_id: maple, classroom_id: room(maple, 'Infants'), name: 'Infant room', stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
    { school_id: maple, classroom_id: null, name: 'Playground', stream_url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8' },
    { school_id: maple, classroom_id: room(maple, 'Preschool'), name: 'Preschool room', stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' },
  ]).select('id'), 'cameras');
  check(await db.from('video_windows').insert(cams.map((c) => ({ camera_id: c.id, days: [0, 1, 2, 3, 4, 5, 6], start_time: '00:00', end_time: '23:59:59' }))), 'windows');

  console.log(`Demo ready: ${kids.length} children across 2 schools.`);
  console.log(`Sign in from the login page (NEXT_PUBLIC_DEMO_MODE=true) or with any of:`);
  for (const a of DEMO_ACCOUNTS) console.log(`  ${a.label.padEnd(12)} ${a.email}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
