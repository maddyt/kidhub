'use server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { requireAdmin, SCHOOL_COOKIE } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const int = (f: FormData, k: string) => { const n = parseInt(str(f, k), 10); return Number.isFinite(n) && n > 0 ? n : null; };

export async function updateSchool(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await supabaseServer();
  const { error } = await supabase.from('schools').update({
    name: str(form, 'name'), address: str(form, 'address') || null, timezone: str(form, 'timezone'),
    opens_at: str(form, 'opens_at'), closes_at: str(form, 'closes_at'), require_photo_approval: form.get('require_photo_approval') === 'on',
  }).eq('id', ctx.school.id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Saved.' };
}

export async function saveClassroom(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await supabaseServer();
  const row = {
    school_id: ctx.school.id, name: str(form, 'name'), age_group: str(form, 'age_group') || 'preschool',
    ratio: int(form, 'ratio') ?? 10, capacity: int(form, 'capacity'),
    diaper_interval_min: int(form, 'diaper_interval_min'), bottle_interval_min: int(form, 'bottle_interval_min'),
  };
  if (!row.name) return { error: 'Name the classroom.' };
  const id = str(form, 'id');
  const { error } = id ? await supabase.from('classrooms').update(row).eq('id', id) : await supabase.from('classrooms').insert(row);
  if (error) return { error: error.message };
  revalidatePath('/settings');
  return { ok: true, message: id ? 'Saved.' : 'Classroom added.' };
}

export async function deleteClassroom(form: FormData) {
  await requireAdmin();
  const supabase = await supabaseServer();
  await supabase.from('classrooms').delete().eq('id', str(form, 'id'));
  revalidatePath('/settings');
}

export async function addSchool(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  if (ctx.role !== 'owner') return { error: 'Only owners can add schools.' };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from('schools').insert({
    org_id: ctx.school.org_id, name: str(form, 'name'), timezone: str(form, 'timezone') || ctx.school.timezone,
  }).select('id').single();
  if (error) return { error: error.message };
  (await cookies()).set(SCHOOL_COOKIE, data.id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/', 'layout');
  return { ok: true, message: 'School added and selected. Add its classrooms below.' };
}
