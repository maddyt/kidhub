'use server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { adminMfaRequired, isDemoAccount } from '@/lib/security/mfa.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

export async function updateName(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireUser();
  if (isDemoAccount(ctx.email)) return { error: 'Demo accounts can’t be changed.' };
  const full_name = String(form.get('full_name') ?? '').trim().slice(0, 120);
  if (!full_name) return { error: 'Enter your name.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.from('profiles').update({ full_name, phone: String(form.get('phone') ?? '').trim() || null }).eq('id', ctx.userId);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Saved.' };
}

export async function changePassword(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireUser();
  if (isDemoAccount(ctx.email)) return { error: 'Demo accounts can’t be changed.' };
  const password = String(form.get('password') ?? '');
  if (password.length < 10) return { error: 'Use at least 10 characters.' };
  if (password !== String(form.get('confirm') ?? '')) return { error: 'The two passwords don’t match.' };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: true, message: 'Password changed.' };
}

export async function disableMfa(_: ActionResult): Promise<ActionResult> {
  const ctx = await requireUser();
  if (adminMfaRequired() && (ctx.role === 'owner' || ctx.schools.some((s) => s.role !== 'teacher'))) {
    return { error: 'Owners and directors must keep two-step verification on.' };
  }
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.mfa.listFactors();
  for (const f of data?.all ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (error) return { error: error.message };
  }
  revalidatePath('/account');
  return { ok: true, message: 'Two-step verification is off.' };
}
