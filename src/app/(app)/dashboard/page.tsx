import Link from 'next/link';
import { requireStaff, alertScope } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { loadToday, isPresent } from '@/lib/data/today.ts';
import { loadSnapshot } from '@/lib/data/snapshot.ts';
import { buildAlerts } from '@/lib/domain/alerts.ts';
import { ratioStatus } from '@/lib/domain/ratios.ts';
import { money } from '@/lib/domain/billing.ts';
import { dayIn, formatDate } from '@/lib/domain/time.ts';
import { PageHeader, Stat, AlertList, Badge, Empty } from '@/components/ui.tsx';

export const metadata = { title: 'Today' };

export default async function Dashboard() {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const scope = alertScope(ctx);
  const [t, snap, ann] = await Promise.all([
    loadToday(supabase, ctx.school),
    loadSnapshot(supabase, scope),
    supabase.from('announcements').select('id, title, kind, created_at').eq('school_id', ctx.school.id).order('created_at', { ascending: false }).limit(3),
  ]);
  let alerts = buildAlerts(snap);
  // Teachers see safety and care alerts for their school, not billing or compliance.
  if (!ctx.isAdmin) alerts = alerts.filter((a) => a.category === 'safety' || a.category === 'care');
  const schoolName = (id: string) => ctx.schools.find((s) => s.id === id)?.name ?? '';

  const present = t.children.filter((c) => isPresent(t.attendanceByChild.get(c.id)));
  const overdueCents = snap.openInvoices
    .filter((i) => i.school_id === ctx.school.id && i.due_on < t.today).reduce((s, i) => s + i.amount_cents, 0);

  const sites = ctx.role === 'owner' && scope.length > 1 ? scope.map((s) => {
    const today = dayIn(s.timezone);
    const enrolled = snap.children.filter((c) => c.school_id === s.id).length;
    const here = snap.openAttendance.filter((a) => a.school_id === s.id && a.day === today).length;
    const staff = snap.openShifts.filter((x) => x.school_id === s.id).length;
    const owed = snap.openInvoices.filter((i) => i.school_id === s.id && i.due_on < today).reduce((sum, i) => sum + i.amount_cents, 0);
    const crit = alerts.filter((a) => a.school_id === s.id && a.severity === 'critical').length;
    return { s, enrolled, here, staff, owed, crit };
  }) : [];

  return (
    <div className="space-y-6">
      <PageHeader title={`Today at ${ctx.school.name}`} subtitle={formatDate(t.today)}
        actions={<><Link href="/attendance" className="btn-primary">Check in / out</Link><Link href="/log" className="btn-secondary">Log care</Link></>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Checked in" value={`${present.length} / ${t.children.length}`} hint="enrolled children" />
        <Stat label="Staff on shift" value={t.shifts.length} hint={t.shifts.map((s) => s.name.split(' ')[0]).join(', ') || 'nobody clocked in'} />
        <Stat label="Alerts" value={alerts.length} tone={alerts.some((a) => a.severity === 'critical') ? 'red' : alerts.length ? 'amber' : undefined}
          hint={`${alerts.filter((a) => a.severity === 'critical').length} critical`} />
        {ctx.isAdmin
          ? <Stat label="Overdue tuition" value={money(overdueCents)} tone={overdueCents ? 'amber' : undefined} hint="this school" />
          : <Stat label="Entries today" value={t.activities.length} hint="care log" />}
      </div>

      {sites.length > 0 && (
        <section className="card overflow-x-auto">
          <h2 className="h2 mb-2">All schools</h2>
          <table className="table">
            <thead><tr><th>School</th><th>Here now</th><th>Staff</th><th>Overdue</th><th>Critical alerts</th></tr></thead>
            <tbody>{sites.map(({ s, enrolled, here, staff, owed, crit }) => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}</td><td>{here} / {enrolled}</td><td>{staff}</td><td>{money(owed)}</td>
                <td>{crit ? <Badge tone="red">{crit}</Badge> : <Badge tone="green">0</Badge>}</td>
              </tr>))}
            </tbody>
          </table>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-3">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="h2">Alerts</h2>
            <span className="text-xs text-muted">AI flags, people decide</span>
          </div>
          <AlertList alerts={alerts} schoolName={scope.length > 1 ? schoolName : undefined} />
        </section>

        <section className="card lg:col-span-2">
          <h2 className="h2 mb-2">Classrooms</h2>
          {t.classrooms.length === 0 ? <Empty>No classrooms yet. {ctx.isAdmin && <Link className="underline" href="/settings">Add one</Link>}</Empty> : (
            <ul className="divide-y divide-rule">
              {t.classrooms.map((room) => {
                const kids = present.filter((c) => c.classroom_id === room.id).length;
                const staff = t.shifts.filter((s) => s.classroom_id === room.id).length;
                const r = ratioStatus(kids, staff, room.ratio);
                return (
                  <li key={room.id} className="flex items-center justify-between py-2">
                    <div><div className="font-medium">{room.name}</div><div className="muted text-xs">1:{room.ratio} ratio · {kids} children · {staff} staff</div></div>
                    {r.ok ? <Badge tone="green">In ratio</Badge> : <Badge tone="red">Needs {r.requiredStaff - staff} more</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
          <h2 className="h2 mb-2 mt-5">Announcements</h2>
          {(ann.data ?? []).length === 0 ? <p className="muted">None yet.</p> : (
            <ul className="space-y-1">{(ann.data ?? []).map((a) => (
              <li key={a.id} className="text-sm"><Badge tone={a.kind === 'emergency' ? 'red' : a.kind === 'closure' ? 'amber' : 'gray'}>{a.kind}</Badge> {a.title}</li>
            ))}</ul>
          )}
        </section>
      </div>
    </div>
  );
}
