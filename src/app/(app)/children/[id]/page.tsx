import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { loadDailyReport } from '@/lib/data/report.ts';
import { appOrigin } from '@/lib/origin.ts';
import { ageLabel, dayIn, formatDate } from '@/lib/domain/time.ts';
import { money } from '@/lib/domain/billing.ts';
import { PageHeader, Badge, Avatar, Field, Empty } from '@/components/ui.tsx';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { ChildFields } from '@/components/ChildFields.tsx';
import { CopyField } from '@/components/CopyField.tsx';
import { DailyReportView } from '@/components/DailyReportView.tsx';
import { updateChild, addPickup, removePickup, inviteGuardian, deleteInvite, setVideoApproval, removeGuardian } from '../actions.ts';

export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const { data: child } = await supabase.from('children').select('*').eq('id', id).maybeSingle();
  if (!child) notFound();
  const tz = ctx.school.timezone;
  const today = dayIn(tz);
  const [{ data: rooms }, { data: guardians }, { data: pickups }, { data: invites }, { data: plans }, report, origin] = await Promise.all([
    supabase.from('classrooms').select('id, name').eq('school_id', child.school_id).order('name'),
    supabase.from('guardians').select('profile_id, relationship, access, video_approved, profile:profiles(full_name, email, phone)').eq('child_id', id),
    supabase.from('pickups').select('*').eq('child_id', id).order('created_at'),
    ctx.isAdmin ? supabase.from('invitations').select('id, token, email, relationship, access, expires_at').eq('child_id', id).is('accepted_at', null)
      : Promise.resolve({ data: [] as any[] }),
    ctx.isAdmin ? supabase.from('billing_plans').select('id, description, amount_cents, frequency, next_bill_date, active').eq('child_id', id)
      : Promise.resolve({ data: [] as any[] }),
    loadDailyReport(supabase, id, today, tz),
    appOrigin(),
  ]);
  const name = `${child.first_name} ${child.last_name}`;
  const room = (rooms ?? []).find((r) => r.id === child.classroom_id);

  return (
    <div className="space-y-5">
      <Link href="/children" className="muted hover:underline">← Children</Link>
      <div className="flex items-center gap-3">
        <Avatar name={name} size={48} />
        <PageHeader title={name} subtitle={[ageLabel(child.birth_date, today), room?.name, child.status].filter(Boolean).join(' · ')}
          actions={<Link href={`/messages/${id}`} className="btn-secondary">💬 Message family</Link>} />
      </div>

      {(child.allergies || child.medical_notes) && (
        <div className="card border-danger/40 bg-danger/5">
          <div className="label text-danger">Medical & allergies</div>
          {child.allergies && <div className="font-semibold text-danger">⚠ {child.allergies}</div>}
          {child.medical_notes && <div className="text-sm">{child.medical_notes}</div>}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2 mb-2">Today · {formatDate(today)}</h2>
          <DailyReportView report={report} />
        </section>

        <div className="space-y-5">
          <section className="card">
            <h2 className="h2 mb-2">Family</h2>
            {(guardians ?? []).length === 0 && <p className="muted">No family accounts linked yet.</p>}
            <ul className="divide-y divide-rule">{(guardians ?? []).map((g: any) => {
              const p = Array.isArray(g.profile) ? g.profile[0] : g.profile;
              return (
                <li key={g.profile_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <div className="font-medium">{p?.full_name || p?.email} <span className="muted">· {g.relationship}</span></div>
                    <div className="text-xs text-muted">{p?.email}{p?.phone ? ` · ${p.phone}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {g.access === 'video_only' && <Badge>video only</Badge>}
                    {g.video_approved ? <Badge tone="green">video approved</Badge> : <Badge tone="amber">video pending</Badge>}
                    {ctx.isAdmin && <>
                      <form action={setVideoApproval}>
                        <input type="hidden" name="child_id" value={id} /><input type="hidden" name="profile_id" value={g.profile_id} />
                        <input type="hidden" name="approved" value={String(!g.video_approved)} />
                        <button className="btn-secondary btn-sm">{g.video_approved ? 'Revoke video' : 'Approve video'}</button>
                      </form>
                      <form action={removeGuardian}>
                        <input type="hidden" name="child_id" value={id} /><input type="hidden" name="profile_id" value={g.profile_id} />
                        <button className="text-xs text-muted hover:text-danger">remove</button>
                      </form>
                    </>}
                  </div>
                </li>
              );
            })}</ul>
            {ctx.isAdmin && (
              <>
                {(invites ?? []).map((inv: any) => (
                  <div key={inv.id} className="mt-3 rounded-lg bg-canvas p-2">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span>Invite for {inv.relationship}{inv.email ? ` (${inv.email})` : ''}{inv.access === 'video_only' ? ' · video only' : ''} · expires {String(inv.expires_at).slice(0, 10)}</span>
                      <form action={deleteInvite}><input type="hidden" name="id" value={inv.id} /><input type="hidden" name="child_id" value={id} /><button className="text-muted hover:text-danger">cancel</button></form>
                    </div>
                    <CopyField value={`${origin}/join/${inv.token}`} />
                  </div>
                ))}
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-brand">+ Invite a parent or family member</summary>
                  <ActionForm action={inviteGuardian} className="mt-2 grid gap-2 sm:grid-cols-3">
                    <input type="hidden" name="child_id" value={id} />
                    <Field label="Relationship"><input name="relationship" defaultValue="parent" className="input" /></Field>
                    <Field label="Their email (only they can use the link)"><input name="email" type="email" required className="input" /></Field>
                    <Field label="Access">
                      <select name="access" className="input"><option value="full">Full (reports, billing, messages)</option><option value="video_only">Video only</option></select>
                    </Field>
                    <div className="sm:col-span-3"><SubmitButton>Create invitation link</SubmitButton></div>
                  </ActionForm>
                </details>
              </>
            )}
          </section>

          <section className="card">
            <h2 className="h2 mb-2">Approved pickups & emergency contacts</h2>
            {(pickups ?? []).length === 0 && <p className="muted">Parents with full access can always pick up. Add others here.</p>}
            <ul className="divide-y divide-rule">{(pickups ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span><span className="font-medium">{p.name}</span> {p.relationship && <span className="muted">· {p.relationship}</span>} {p.phone && <span className="muted">· {p.phone}</span>}</span>
                <span className="flex items-center gap-1">
                  {p.can_pickup ? <Badge tone="green">pickup</Badge> : <Badge tone="red">no pickup</Badge>}
                  {p.is_emergency_contact && <Badge tone="amber">emergency</Badge>}
                  {ctx.isAdmin && <form action={removePickup}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="child_id" value={id} /><button className="ml-1 text-xs text-muted hover:text-danger">remove</button></form>}
                </span>
              </li>
            ))}</ul>
            {ctx.isAdmin && (
              <ActionForm action={addPickup} resetOnSuccess className="mt-3 grid gap-2 sm:grid-cols-3">
                <input type="hidden" name="child_id" value={id} />
                <input name="name" placeholder="Name" required className="input" />
                <input name="relationship" placeholder="Relationship" className="input" />
                <input name="phone" placeholder="Phone" className="input" />
                <label className="text-sm"><input type="checkbox" name="can_pickup" defaultChecked /> Allowed to pick up</label>
                <label className="text-sm"><input type="checkbox" name="is_emergency_contact" /> Emergency contact</label>
                <SubmitButton className="btn-secondary">Add</SubmitButton>
              </ActionForm>
            )}
          </section>

          {ctx.isAdmin && (
            <section className="card">
              <h2 className="h2 mb-2">Billing</h2>
              {(plans ?? []).length === 0 ? <p className="muted">No recurring plan.</p> : (
                <ul className="text-sm">{(plans ?? []).map((p: any) => (
                  <li key={p.id}>{p.description}: {money(p.amount_cents)} {p.frequency} · next {p.next_bill_date} {!p.active && <Badge>paused</Badge>}</li>
                ))}</ul>
              )}
              <Link href={`/billing?child=${id}`} className="mt-2 inline-block text-sm text-brand underline">Manage billing</Link>
            </section>
          )}
        </div>
      </div>

      {ctx.isAdmin && (
        <details className="card">
          <summary className="cursor-pointer font-medium">Edit details</summary>
          <ActionForm action={updateChild} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={id} />
            <ChildFields v={child} rooms={rooms ?? []} />
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
