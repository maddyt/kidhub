import { requireStaff } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { loadToday, isPresent } from '@/lib/data/today.ts';
import { careTimers, isNapping } from '@/lib/domain/care.ts';
import { describe, ACTIVITY_ICONS } from '@/lib/domain/report.ts';
import { formatTime, formatDate } from '@/lib/domain/time.ts';
import { PageHeader, Badge, Empty } from '@/components/ui.tsx';
import { LogForm } from './LogForm.tsx';
import { deleteActivity } from './actions.ts';

export const metadata = { title: 'Care log' };

const STATE_TONE = { ok: 'green', due: 'amber', overdue: 'red' } as const;

export default async function LogPage() {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const t = await loadToday(supabase, ctx.school);
  const tz = ctx.school.timezone;
  const room = new Map(t.classrooms.map((r) => [r.id, r]));
  const present = t.children.filter((c) => isPresent(t.attendanceByChild.get(c.id)));
  const nameOf = new Map(t.children.map((c) => [c.id, `${c.first_name} ${c.last_name}`]));

  return (
    <div className="space-y-6">
      <PageHeader title="Care log" subtitle={`${formatDate(t.today)} · log once, it appears in each child’s daily report`} />
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <LogForm rooms={t.classrooms.map((r) => ({ id: r.id, name: r.name }))}
            kids={t.children.map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name[0]}.`, classroom_id: c.classroom_id,
              present: isPresent(t.attendanceByChild.get(c.id)), allergies: c.allergies }))} />
        </section>
        <section className="card lg:col-span-2">
          <h2 className="h2 mb-2">Care timers</h2>
          {present.length === 0 ? <Empty>Timers appear for checked-in children.</Empty> : (
            <ul className="divide-y divide-rule">{present.map((c) => {
              const acts = t.activities.filter((a) => a.child_id === c.id);
              const cr = c.classroom_id ? room.get(c.classroom_id) : undefined;
              const timers = cr ? careTimers(acts, t.attendanceByChild.get(c.id)!.check_in_at, cr) : [];
              const lastMeal = acts.find((a) => a.type === 'meal');
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-sm font-medium">{c.first_name} {c.last_name[0]}.</span>
                  <span className="flex flex-wrap gap-1">
                    {isNapping(acts) && <Badge tone="brand">😴 napping</Badge>}
                    {timers.map((tm) => <Badge key={tm.kind} tone={STATE_TONE[tm.state]}>{tm.kind === 'diaper' ? '🧷' : '🍼'} {tm.minutesSince}m</Badge>)}
                    {lastMeal && <Badge>🍎 {formatTime(lastMeal.occurred_at, tz)}</Badge>}
                  </span>
                </li>
              );
            })}</ul>
          )}
          <p className="muted mt-2 text-xs">Timers turn amber at 80% of the room’s interval and red when overdue. Set intervals in Settings → Classrooms.</p>
        </section>
      </div>

      <section className="card">
        <h2 className="h2 mb-2">Today’s entries</h2>
        {t.activities.length === 0 ? <Empty>Nothing logged yet today.</Empty> : (
          <ul className="divide-y divide-rule">{t.activities.map((a) => (
            <li key={a.id} className="flex items-start gap-3 py-2 text-sm">
              <span className="w-16 shrink-0 text-muted">{formatTime(a.occurred_at, tz)}</span>
              <span className="flex-1">
                <span className="font-medium">{nameOf.get(a.child_id) ?? 'Child'}</span> · {ACTIVITY_ICONS[a.type]} {describe(a)}
                {a.note && <span className="muted"> · {a.note}</span>}
                {!a.approved && <> <Badge tone="amber">awaiting approval</Badge></>}
              </span>
              <form action={deleteActivity}><input type="hidden" name="id" value={a.id} /><button className="text-xs text-muted hover:text-danger">delete</button></form>
            </li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
