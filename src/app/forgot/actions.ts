'use server';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { appOrigin } from '@/lib/origin.ts';
import { allow, clientIp, LIMITS, TOO_MANY } from '@/lib/security/rate-limit.ts';
import { EMAIL_RE } from '@/lib/security/compare.ts';
import { isDemoAccount } from '@/lib/security/mfa.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

const SENT = 'If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).';

/** Sends Supabase's password-reset email. Always gives the same answer so it can't be used to discover accounts. */
export async function requestReset(_: ActionResult, form: FormData): Promise<ActionResult> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };
  if (!(await allow(`forgot:ip:${await clientIp()}`, LIMITS.forgotIp)) || !(await allow(`forgot:email:${email}`, LIMITS.forgotEmail))) {
    return { error: TOO_MANY };
  }
  if (isDemoAccount(email)) return { ok: true, message: SENT };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await appOrigin()}/auth/callback?next=/account?recovery=1` });
  if (error) console.warn('password reset email failed:', error.message);
  return { ok: true, message: SENT };
}
