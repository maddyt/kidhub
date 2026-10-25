import Link from 'next/link';
import { requireStaff } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { appOrigin } from '@/lib/origin.ts';
import { dayIn, addDays, formatTime, dayBounds } from '@/lib/domain/time.ts';
import { CERT_WARNING_DAYS } from '@/lib/domain/alerts.ts';
import { PageHeader, Badge, Field, Empty } from '@/components/ui.tsx';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { CopyField } from '@/components/CopyField.tsx';
import { clockIn, clockOut, changeRoom, addCert, deleteCert, inviteStaff, setStaffRole, resetStaffMfa } from './actions.ts';
import { deleteInvite } from '../children/actions.ts';

export const metadata = { title: 'Staff' };

/** Monday of the week containing `day`. */
function weekStart(day: string) {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((dow + 6) % 7));
}

export default async function StaffPage() {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const tz = ctx.school.timezone;
  const today = dayIn(tz);
  const monday = weekStart(today);
  const since = dayBounds(monday, tz).start.toISOString();

  const [{ data: rooms }, { data: staff }, { data: owners }, { data: shifts }, { data: certs }, { data: invites }, origin] = await Promise.all([
    supabase.from('classrooms').select('id, name').eq('school_id', ctx.school.id).order('name'),
    supabase.from('school_staff').select('profile_id, role, profile:profiles(full_name, email)').eq('school_id', ctx.school.id),
    supabase.from('org_owners').select('profile_id, profile:profiles(full_name, email)').eq('org_id', ctx.school.org_id),
    supabase.from('shifts').select('id, profile_id, classroom_id, clock_in_at, clock_out_at').eq('school_id', ctx.school.id).gte('clock_in_at', since).order('clock_in_at'),
    supabase.from('certifications').select('id, profile_id, name, expires_on').eq('school_id', ctx.school.id).order('expires_on'),
    ctx.isAdmin ? supabase.from('invitations').select('id, token, role, email, expires_at').eq('school_id', ctx.school.id).neq('role', 'guardian').is('accepted_at', null)
      : Promise.resolve({ data: [] as any[] }),
    appOrigin(),
  ]);
  const one = (p: any) => (Array.isArray(p) ? p[0] : p);
  const people = [
    ...(owners ?? []).map((o: any) => ({ id: o.profile_id, name: one(o.profile)?.full_name || one(o.profile)?.email, role: 'owner' })),
    ...(staff ?? []).filter((s: any) => !(owners ?? []).some((o: any) => o.profile_id === s.profile_id))
      .map((s: any) => ({ id: s.profile_id, name: one(s.profile)?.full_name || one(s.profile)?.email, role: s.role as string })),
  ];
  const nameOf = new Map(people.map((p) => [p.id, p.name]));
  const roomName = new Map((rooms ?? []).map((r) => [r.id, r.name]));
  const open = (shifts ?? []).filter((s) => !s.clock_out_at);
  const mine = open.find((s) => s.profile_id === ctx.userId);
  const hours = new Map<string, number>();
  const now = Date.now();
  for (const s of shifts ?? []) {
    const ms = (s.clock_out_at ? new Date(s.clock_out_at).getTime() : now) - new Date(s.clock_in_at).getTime();
    hours.set(s.profile_id, (hours.get(s.profile_id) ?? 0) + ms / 3.6e6);
  }
  const certState = (d: string | null) => !d ? null : d < today ? 'expired' : d <= addDays(today, CERT_WARNING_DAYS) ? 'soon' : 'ok';
  const visibleCerts = (certs ?? []).filter((c) => ctx.isAdmin || c.profile_id === ctx.userId);

  return (
    <div className="space-y-5">
      <PageHeader title="Staff" subtitle={ctx.school.name} />

      <section className="card flex flex-wrap items-center gap-3">
        {mine ? (
          <>
            <Badge tone="green">On shift since {formatTime(mine.clock_in_at, tz)}{mine.classroom_id ? ` · ${roomName.get(mine.classroom_id)}` : ''}</Badge>
            <form action={changeRoom} className="flex gap-2">
              <select name="classroom_id" defaultValue={mine.classroom_id ?? ''} className="input w-44 py-1.5" aria-label="Room">
                <option value="">Floating / office</option>{(rooms ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button className="btn-secondary">Move room</button>
            </form>
            <form action={clockOut}><button className="btn-danger">Clock out</button></form>
          </>
        ) : (
          <form action={clockIn} className="flex flex-wrap gap-2">
            <select name="classroom_id" className="input w-48 py-1.5" aria-label="Room">
              <option value="">Floating / office</option>{(rooms ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button className="btn-primary">Clock in</button>
          </form>
        )}
        <span className="muted text-xs">Ratios use the room you are clocked into.</span>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2 mb-2">On shift now</h2>
          {open.length === 0 ? <Empty>Nobody is clocked in.</Empty> : (
            <ul className="divide-y divide-rule">{open.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span><span className="font-medium">{nameOf.get(s.profile_id) ?? 'Staff'}</span> <span className="muted">· {s.classroom_id ? roomName.get(s.classroom_id) : 'floating'} · since {formatTime(s.clock_in_at, tz)}</span></span>
                {ctx.isAdmin && s.profile_id !== ctx.userId && <form action={clockOut}><input type="hidden" name="shift_id" value={s.id} /><button className="text-xs text-muted hover:text-danger">clock out</button></form>}
              </li>
            ))}</ul>
          )}
        </section>

        <section className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="h2">Hours this week</h2>
            {ctx.isAdmin && <Link href={`/api/timesheet?from=${monday}`} className="text-sm text-brand underline">Export CSV (payroll)</Link>}
          </div>
          <table className="table"><tbody>
            {people.filter((p) => ctx.isAdmin || p.id === ctx.userId).map((p) => (
              <tr key={p.id}><td>{p.name}</td><td className="text-right">{(hours.get(p.id) ?? 0).toFixed(1)} h</td></tr>
            ))}
          </tbody></table>
        </section>
      </div>

      <section className="card">
        <h2 className="h2 mb-2">Certifications</h2>
        {visibleCerts.length === 0 ? <p className="muted">None recorded.</p> : (
          <table className="table"><thead><tr><th>Person</th><th>Certification</th><th>Expires</th><th /></tr></thead><tbody>
            {visibleCerts.map((c) => {
              const st = certState(c.expires_on);
              return (
                <tr key={c.id}><td>{nameOf.get(c.profile_id) ?? '—'}</td><td>{c.name}</td>
                  <td>{c.expires_on ?? '—'} {st === 'expired' && <Badge tone="red">expired</Badge>}{st === 'soon' && <Badge tone="amber">soon</Badge>}</td>
                  <td className="text-right"><form action={deleteCert}><input type="hidden" name="id" value={c.id} /><button className="text-xs text-muted hover:text-danger">remove</button></form></td></tr>
              );
            })}
          </tbody></table>
        )}
        <ActionForm action={addCert} resetOnSuccess className="mt-3 grid gap-2 sm:grid-cols-4">
          {ctx.isAdmin ? (
            <select name="profile_id" className="input" aria-label="Person">{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          ) : <input type="hidden" name="profile_id" value={ctx.userId} />}
          <input name="name" placeholder="e.g. Pediatric CPR" required className="input" />
          <input name="expires_on" type="date" className="input" aria-label="Expires on" />
          <SubmitButton className="btn-secondary">Add certification</SubmitButton>
        </ActionForm>
      </section>

      {ctx.isAdmin && (
        <section className="card">
          <h2 className="h2 mb-2">Team</h2>
          <table className="table"><tbody>{people.map((p) => (
            <tr key={p.id}><td className="font-medium">{p.name}</td><td className="capitalize">{p.role}</td>
              <td className="text-right">{p.role !== 'owner' && p.id !== ctx.userId && (
                <form action={setStaffRole} className="inline-flex gap-1">
                  <input type="hidden" name="school_id" value={ctx.school.id} /><input type="hidden" name="profile_id" value={p.id} />
                  <select name="role" defaultValue={p.role} className="input w-32 py-1 text-xs" aria-label="Role"><option value="teacher">Teacher</option><option value="director">Director</option><option value="remove">Remove</option></select>
                  <button className="btn-secondary btn-sm">Update</button>
                </form>)}
                {ctx.role === 'owner' && p.role !== 'owner' && p.id !== ctx.userId && (
                  <form action={resetStaffMfa} className="ml-2 inline"><input type="hidden" name="profile_id" value={p.id} />
                    <button className="text-xs text-muted hover:underline" title="Use when someone loses the phone with their authenticator app">reset 2-step</button></form>)}</td></tr>
          ))}</tbody></table>
          {(invites ?? []).map((inv: any) => (
            <div key={inv.id} className="mt-3 rounded-lg bg-canvas p-2">
              <div className="mb-1 flex justify-between text-xs"><span className="capitalize">{inv.role} invite{inv.email ? ` · ${inv.email}` : ''} · expires {String(inv.expires_at).slice(0, 10)}</span>
                <form action={deleteInvite}><input type="hidden" name="id" value={inv.id} /><button className="text-muted hover:text-danger">cancel</button></form></div>
              <CopyField value={`${origin}/join/${inv.token}`} />
            </div>
          ))}
          <ActionForm action={inviteStaff} className="mt-3 grid gap-2 sm:grid-cols-4">
            <Field label="Role"><select name="role" className="input"><option value="teacher">Teacher</option><option value="director">Director</option></select></Field>
            <Field label="Their email (only they can use the link)" className="sm:col-span-2"><input name="email" type="email" required className="input" /></Field>
            <div className="flex items-end"><SubmitButton className="btn-primary w-full">Create invite link</SubmitButton></div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
