import Link from 'next/link';
import { requireAdmin } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { US_TIMEZONES } from '@/lib/timezones.ts';
import { PageHeader, Field, Notice } from '@/components/ui.tsx';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { updateSchool, saveClassroom, deleteClassroom, addSchool } from './actions.ts';

export const metadata = { title: 'Settings' };

const AGE_DEFAULTS = 'Typical licensing ratios: infants 1:4, toddlers 1:6, preschool 1:10, school-age 1:15. Check your state’s rules.';

function ClassroomFields({ r }: { r?: any }) {
  return (
    <div className="grid gap-2 sm:grid-cols-6">
      {r && <input type="hidden" name="id" value={r.id} />}
      <Field label="Name" className="sm:col-span-2"><input name="name" defaultValue={r?.name} required className="input" /></Field>
      <Field label="Age group">
        <select name="age_group" defaultValue={r?.age_group ?? 'preschool'} className="input">
          <option value="infant">Infant</option><option value="toddler">Toddler</option><option value="preschool">Preschool</option><option value="school_age">School age</option>
        </select>
      </Field>
      <Field label="Ratio 1:"><input name="ratio" type="number" min={1} defaultValue={r?.ratio ?? 10} className="input" /></Field>
      <Field label="Capacity"><input name="capacity" type="number" min={1} defaultValue={r?.capacity ?? ''} className="input" /></Field>
      <div />
      <Field label="Diaper every (min)" className="sm:col-span-2"><input name="diaper_interval_min" type="number" min={15} placeholder="e.g. 120" defaultValue={r?.diaper_interval_min ?? ''} className="input" /></Field>
      <Field label="Bottle every (min)" className="sm:col-span-2"><input name="bottle_interval_min" type="number" min={15} placeholder="e.g. 180" defaultValue={r?.bottle_interval_min ?? ''} className="input" /></Field>
    </div>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const ctx = await requireAdmin();
  const { welcome } = await searchParams;
  const supabase = await supabaseServer();
  const [{ data: rooms }, { count: kids }, { count: staff }] = await Promise.all([
    supabase.from('classrooms').select('*').eq('school_id', ctx.school.id).order('name'),
    supabase.from('children').select('id', { count: 'exact', head: true }).eq('school_id', ctx.school.id),
    supabase.from('school_staff').select('profile_id', { count: 'exact', head: true }).eq('school_id', ctx.school.id),
  ]);
  const s = ctx.school;
  const steps = [
    { done: (rooms ?? []).length > 0, text: 'Add your classrooms (below)', href: '#classrooms' },
    { done: (kids ?? 0) > 0, text: 'Add children', href: '/children' },
    { done: (staff ?? 0) > 0, text: 'Invite teachers and directors', href: '/staff' },
    { done: false, text: 'Open a child and create an invitation link for their parents', href: '/children' },
    { done: false, text: 'Set up tuition plans', href: '/billing' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle={s.name} />
      {(welcome || steps.some((x) => !x.done)) && (
        <section className="card">
          <h2 className="h2 mb-2">{welcome ? 'Welcome! Here’s how to get started' : 'Getting started'}</h2>
          <ol className="space-y-1 text-sm">{steps.map((x, i) => (
            <li key={i}>{x.done ? '✅' : '⬜'} <Link href={x.href} className="hover:underline">{x.text}</Link></li>
          ))}</ol>
        </section>
      )}

      <section className="card">
        <h2 className="h2 mb-3">School</h2>
        <ActionForm action={updateSchool} className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input name="name" defaultValue={s.name} required className="input" /></Field>
          <Field label="Address"><input name="address" defaultValue={s.address ?? ''} className="input" /></Field>
          <Field label="Time zone">
            <select name="timezone" defaultValue={s.timezone} className="input">
              {US_TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              {!US_TIMEZONES.some(([v]) => v === s.timezone) && <option value={s.timezone}>{s.timezone}</option>}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Opens"><input name="opens_at" type="time" defaultValue={s.opens_at.slice(0, 5)} className="input" /></Field>
            <Field label="Closes"><input name="closes_at" type="time" defaultValue={s.closes_at.slice(0, 5)} className="input" /></Field>
          </div>
          <label className="text-sm sm:col-span-2"><input type="checkbox" name="require_photo_approval" defaultChecked={s.require_photo_approval} /> Teachers’ photos need director approval before families see them</label>
          <div><SubmitButton>Save school</SubmitButton></div>
        </ActionForm>
      </section>

      <section className="card" id="classrooms">
        <h2 className="h2 mb-1">Classrooms</h2>
        <p className="muted mb-3">{AGE_DEFAULTS} Diaper/bottle intervals drive the care timers; leave blank for older children.</p>
        <div className="space-y-4">
          {(rooms ?? []).map((r) => (
            <div key={r.id} className="rounded-lg border border-rule p-3">
              <ActionForm action={saveClassroom}><ClassroomFields r={r} />
                <div className="mt-2 flex gap-2"><SubmitButton className="btn-secondary btn-sm">Save</SubmitButton></div>
              </ActionForm>
              <form action={deleteClassroom} className="mt-1"><input type="hidden" name="id" value={r.id} /><button className="text-xs text-muted hover:text-danger">Delete classroom</button></form>
            </div>
          ))}
          <div className="rounded-lg border border-dashed border-rule p-3">
            <div className="label">New classroom</div>
            <ActionForm action={saveClassroom} resetOnSuccess><ClassroomFields /><div className="mt-2"><SubmitButton>Add classroom</SubmitButton></div></ActionForm>
          </div>
        </div>
      </section>

      {ctx.role === 'owner' && (
        <section className="card">
          <h2 className="h2 mb-2">Add another school</h2>
          <Notice>Each school has its own classrooms, staff, families and billing. As owner you see all of them and can switch from the menu.</Notice>
          <ActionForm action={addSchool} className="mt-3 grid gap-2 sm:grid-cols-3">
            <Field label="School name"><input name="name" required className="input" /></Field>
            <Field label="Time zone"><select name="timezone" defaultValue={s.timezone} className="input">{US_TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
            <div className="flex items-end"><SubmitButton>Add school</SubmitButton></div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
