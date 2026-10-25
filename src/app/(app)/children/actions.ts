'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, requireUser } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim() || null;

export async function createChild(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await supabaseServer();
  const first_name = s(form, 'first_name'), last_name = s(form, 'last_name');
  if (!first_name || !last_name) return { error: 'First and last name are required.' };
  const { data, error } = await supabase.from('children').insert({
    school_id: ctx.school.id, first_name, last_name, birth_date: s(form, 'birth_date'), classroom_id: s(form, 'classroom_id'),
    status: s(form, 'status') ?? 'enrolled', allergies: s(form, 'allergies'), medical_notes: s(form, 'medical_notes'), start_date: s(form, 'start_date'),
  }).select('id').single();
  if (error) return { error: error.message };
  redirect(`/children/${data.id}`);
}

export async function updateChild(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await supabaseServer();
  const id = String(form.get('id'));
  const { error } = await supabase.from('children').update({
    first_name: s(form, 'first_name'), last_name: s(form, 'last_name'), birth_date: s(form, 'birth_date'),
    classroom_id: s(form, 'classroom_id'), status: s(form, 'status'), allergies: s(form, 'allergies'),
    medical_notes: s(form, 'medical_notes'), start_date: s(form, 'start_date'),
  }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/children/${id}`);
  return { ok: true, message: 'Saved.' };
}

// Admins and full guardians (RLS enforces which).
export async function addPickup(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireUser();
  const supabase = await supabaseServer();
  const child_id = String(form.get('child_id'));
  const name = s(form, 'name');
  if (!name) return { error: 'Name is required.' };
  const { error } = await supabase.from('pickups').insert({
    child_id, name, relationship: s(form, 'relationship'), phone: s(form, 'phone'),
    is_emergency_contact: form.get('is_emergency_contact') === 'on', can_pickup: form.get('can_pickup') === 'on',
  });
  if (error) return { error: error.message };
  revalidatePath(`/children/${child_id}`); revalidatePath('/family/people');
  return { ok: true };
}

export async function removePickup(form: FormData) {
  const supabase = await supabaseServer();
  await supabase.from('pickups').delete().eq('id', String(form.get('id')));
  revalidatePath(`/children/${form.get('child_id')}`); revalidatePath('/family/people');
}

export async function inviteGuardian(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await supabaseServer();
  const child_id = String(form.get('child_id'));
  const { error } = await supabase.from('invitations').insert({
    school_id: ctx.school.id, role: 'guardian', child_id, email: s(form, 'email')?.toLowerCase() ?? null,
    relationship: s(form, 'relationship') ?? 'parent', access: form.get('access') === 'video_only' ? 'video_only' : 'full', created_by: ctx.userId,
  });
  if (error) return { error: error.message };
  revalidatePath(`/children/${child_id}`);
  return { ok: true, message: 'Invitation link created below. Send it to the family by text or email.' };
}

export async function deleteInvite(form: FormData) {
  const supabase = await supabaseServer();
  await supabase.from('invitations').delete().eq('id', String(form.get('id')));
  revalidatePath(`/children/${form.get('child_id')}`); revalidatePath('/staff'); revalidatePath('/family/people');
}

export async function setVideoApproval(form: FormData) {
  await requireAdmin();
  const supabase = await supabaseServer();
  await supabase.from('guardians').update({ video_approved: form.get('approved') === 'true' })
    .eq('child_id', String(form.get('child_id'))).eq('profile_id', String(form.get('profile_id')));
  revalidatePath(`/children/${form.get('child_id')}`); revalidatePath('/approvals');
}

export async function removeGuardian(form: FormData) {
  await requireAdmin();
  const supabase = await supabaseServer();
  await supabase.from('guardians').delete().eq('child_id', String(form.get('child_id'))).eq('profile_id', String(form.get('profile_id')));
  revalidatePath(`/children/${form.get('child_id')}`);
}
