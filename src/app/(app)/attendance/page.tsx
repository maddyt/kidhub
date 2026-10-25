import Link from 'next/link';
import { requireStaff } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { loadToday, isPresent } from '@/lib/data/today.ts';
import { loadAuthorizedPickups } from '@/lib/data/people.ts';
import { formatTime, formatDate, ageLabel } from '@/lib/domain/time.ts';
import { PageHeader, Badge, Avatar, Empty } from '@/components/ui.tsx';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { checkIn, checkOut, undoAttendance, closeStale } from './actions.ts';

export const metadata = { title: 'Attendance' };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ room?: string }> }) {
  const ctx = await requireStaff();
  const { room } = await searchParams;
  const supabase = await supabaseServer();
  const t = await loadToday(supabase, ctx.school);
  const pickups = await loadAuthorizedPickups(supabase, t.children.map((c) => c.id));
  const { data: stale } = await supabase.from('attendance').select('id, child_id, day, check_in_at')
    .eq('school_id', ctx.school.id).is('check_out_at', null).lt('day', t.today);

  const rooms = room ? t.classrooms.filter((r) => r.id === room) : t.classrooms;
  const unassigned = room ? [] : t.children.filter((c) => !c.classroom_id || !t.classrooms.some((r) => r.id === c.classroom_id));
  const groups = [...rooms.map((r) => ({ id: r.id, name: r.name, kids: t.children.filter((c) => c.classroom_id === r.id) })),
    ...(unassigned.length ? [{ id: 'none', name: 'No classroom', kids: unassigned }] : [])];
  const presentCount = t.children.filter((c) => isPresent(t.attendanceByChild.get(c.id))).length;
  const childName = (id: string) => { const c = t.children.find((x) => x.id === id); return c ? `${c.first_name} ${c.last_name}` : 'Child'; };

  return (
    <div className="space-y-5">
      <PageHeader title="Attendance" subtitle={`${formatDate(t.today)} · ${presentCount} of ${t.children.length} here`} />

      {(stale ?? []).length > 0 && (
        <div className="card border-danger/40">
          <h2 className="h2 text-danger">Missed check-outs</h2>
          <ul className="mt-2 space-y-2">{(stale ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{childName(s.child_id)} checked in {s.day} at {formatTime(s.check_in_at, ctx.school.timezone)} and was never checked out.</span>
              <form action={closeStale}><input type="hidden" name="id" value={s.id} /><button className="btn-secondary btn-sm">Close record</button></form>
            </li>))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/attendance" className={`chip ${!room ? 'bg-brand text-white' : 'bg-white border border-rule'}`}>All rooms</Link>
        {t.classrooms.map((r) => <Link key={r.id} href={`/attendance?room=${r.id}`} className={`chip ${room === r.id ? 'bg-brand text-white' : 'bg-white border border-rule'}`}>{r.name}</Link>)}
      </div>

      {groups.length === 0 && <Empty>No enrolled children yet.</Empty>}
      {groups.map((g) => (
        <section key={g.id} className="card">
          <h2 className="h2 mb-2">{g.name} <span className="muted font-normal">· {g.kids.filter((c) => isPresent(t.attendanceByChild.get(c.id))).length}/{g.kids.length}</span></h2>
          <ul className="divide-y divide-rule">
            {g.kids.map((c) => {
              const a = t.attendanceByChild.get(c.id);
              const people = pickups.get(c.id) ?? [];
              const name = `${c.first_name} ${c.last_name}`;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={name} />
                  <div className="min-w-[10rem] flex-1">
                    <Link href={`/children/${c.id}`} className="font-medium hover:underline">{name}</Link>
                    <div className="flex flex-wrap items-center gap-1 text-xs text-muted">
                      {ageLabel(c.birth_date, t.today)}
                      {c.allergies && <Badge tone="red">⚠ {c.allergies}</Badge>}
                    </div>
                  </div>
                  {!a && (
                    <ActionForm action={checkIn} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="child_id" value={c.id} />
                      <select name="dropped_off_by" className="input w-44 py-1.5" aria-label="Dropped off by">
                        <option value="">Dropped off by…</option>
                        {people.map((p) => <option key={p.name}>{p.name}</option>)}
                      </select>
                      <SubmitButton className="btn-primary" pendingText="…">Check in</SubmitButton>
                    </ActionForm>
                  )}
                  {a && !a.check_out_at && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="green">In since {formatTime(a.check_in_at, ctx.school.timezone)}</Badge>
                      <ActionForm action={checkOut} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="child_id" value={c.id} />
                        <select name="picked_up_by" required className="input w-48 py-1.5" aria-label="Picked up by">
                          <option value="">Picked up by…</option>
                          {people.map((p) => <option key={p.name} value={p.name}>{p.name}{p.relationship ? ` (${p.relationship})` : ''}</option>)}
                          <option value="Someone not listed">Someone not listed…</option>
                        </select>
                        <SubmitButton className="btn-secondary" pendingText="…">Check out</SubmitButton>
                      </ActionForm>
                      <form action={undoAttendance}><input type="hidden" name="child_id" value={c.id} /><input type="hidden" name="what" value="checkin" />
                        <button className="text-xs text-muted hover:underline">undo</button></form>
                    </div>
                  )}
                  {a?.check_out_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge>Out {formatTime(a.check_out_at, ctx.school.timezone)}</Badge>
                      <span className="muted text-xs">with {a.picked_up_by}</span>
                      <form action={undoAttendance}><input type="hidden" name="child_id" value={c.id} /><input type="hidden" name="what" value="checkout" />
                        <button className="text-xs text-muted hover:underline">undo</button></form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
