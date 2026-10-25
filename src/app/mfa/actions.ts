'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { allow, LIMITS, TOO_MANY } from '@/lib/security/rate-limit.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

async function currentUser() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

/** Second step at sign-in: check the 6-digit code from the authenticator app. */
export async function verifyCode(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!(await allow(`mfa:${user.id}`, LIMITS.mfaUser))) return { error: TOO_MANY };
  const code = String(form.get('code') ?? '').replace(/\s/g, '');
  const factor = (user.factors ?? []).find((f) => f.status === 'verified' && f.factor_type === 'totp');
  if (!factor) redirect('/');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) return { error: 'That code didn’t work. Codes change every 30 seconds; try the current one.' };
  redirect('/');
}

export type EnrollState = { factorId?: string; qr?: string; secret?: string; error?: string } | null;

/** Start setting up an authenticator app: returns the QR code to scan. */
export async function startEnroll(_: EnrollState): Promise<EnrollState> {
  const { supabase, user } = await currentUser();
  // Clear half-finished attempts so they don't pile up.
  for (const f of user.factors ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString().slice(0, 16)}`, issuer: 'KidHub',
  });
  if (error || !data) return { error: error?.message ?? 'Could not start setup.' };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function finishEnroll(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase, user } = await currentUser();
  if (!(await allow(`mfa:${user.id}`, LIMITS.mfaUser))) return { error: TOO_MANY };
  const factorId = String(form.get('factor_id'));
  const code = String(form.get('code') ?? '').replace(/\s/g, '');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { error: 'That code didn’t match. Check the app shows “KidHub” and enter the current code.' };
  redirect('/account?mfa=on');
}

export async function signOutFromMfa() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}
