'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin, requireStaff } from '@/lib/context.ts';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server.ts';
import { EMAIL_RE } from '@/lib/security/compare.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

export async function clockIn(form: FormData) {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const { data: open } = await supabase.from('shifts').select('id').eq('profile_id', ctx.userId).is('clock_out_at', null).limit(1);
  if (!open?.length) {
    await supabase.from('shifts').insert({ school_id: ctx.school.id, profile_id: ctx.userId, classroom_id: String(form.get('classroom_id') || '') || null });
  }
  revalidatePath('/staff'); revalidatePath('/dashboard');
}

/** Move to another room without ending the shift (ratios follow the move). */
export async function changeRoom(form: FormData) {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const now = new Date().toISOString();
  await supabase.from('shifts').update({ clock_out_at: now }).eq('profile_id', ctx.userId).is('clock_out_at', null);
  await supabase.from('shifts').insert({ school_id: ctx.school.id, profile_id: ctx.userId, classroom_id: String(form.get('classroom_id') || '') || null, clock_in_at: now });
  revalidatePath('/staff'); revalidatePath('/dashboard');
}

export async function clockOut(form: FormData) {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const id = String(form.get('shift_id') ?? '');
  let q = supabase.from('shifts').update({ clock_out_at: new Date().toISOString() }).is('clock_out_at', null);
  // Admins can clock out anyone (e.g. someone who forgot); everyone else only themselves.
  q = id && ctx.isAdmin ? q.eq('id', id) : q.eq('profile_id', ctx.userId);
  await q;
  revalidatePath('/staff'); revalidatePath('/dashboard');
}

export async function addCert(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const name = String(form.get('name') ?? '').trim();
  if (!name) return { error: 'Name the certification.' };
  const { error } = await supabase.from('certifications').insert({
    school_id: ctx.school.id, profile_id: String(form.get('profile_id') || ctx.userId), name, expires_on: String(form.get('expires_on') || '') || null,
  });
  if (error) return { error: error.message };
  revalidatePath('/staff');
  return { ok: true };
}

export async function deleteCert(form: FormData) {
  await requireStaff();
  const supabase = await supabaseServer();
  await supabase.from('certifications').delete().eq('id', String(form.get('id')));
  revalidatePath('/staff');
}

export async function inviteStaff(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await supabaseServer();
  const role = form.get('role') === 'director' ? 'director' : 'teacher';
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: 'Enter their email. Only that address can use the link.' };
  const { error } = await supabase.from('invitations').insert({
    school_id: ctx.school.id, role, email, created_by: ctx.userId,
  });
  if (error) return { error: error.message };
  revalidatePath('/staff');
  return { ok: true, message: 'Invitation link created. Copy it from the list and send it.' };
}

export async function setStaffRole(form: FormData) {
  await requireAdmin();
  const supabase = await supabaseServer();
  const role = String(form.get('role'));
  const match = { school_id: String(form.get('school_id')), profile_id: String(form.get('profile_id')) };
  if (role === 'remove') await supabase.from('school_staff').delete().match(match);
  else await supabase.from('school_staff').update({ role }).match(match);
  revalidatePath('/staff');
}

/** Owner-only: clear a staff member's authenticator (lost phone). They set up a new one at next sign-in. */
export async function resetStaffMfa(form: FormData) {
  const ctx = await requireAdmin();
  if (ctx.role !== 'owner') return;
  const profileId = String(form.get('profile_id'));
  if (profileId === ctx.userId) return;
  const supabase = await supabaseServer();
  // Only people who work at one of this owner's schools (RLS limits what the owner can see).
  const { data: member } = await supabase.from('school_staff').select('school_id').eq('profile_id', profileId).eq('school_id', ctx.school.id).maybeSingle();
  if (!member) return;
  const admin = supabaseAdmin();
  const { data } = await admin.auth.admin.mfa.listFactors({ userId: profileId });
  for (const f of data?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ userId: profileId, id: f.id });
  await supabase.rpc('log_event', { p_school: ctx.school.id, p_entity: 'security', p_action: 'mfa_reset', p_entity_id: profileId, p_detail: 'Two-step verification reset by owner' });
  revalidatePath('/staff');
}
