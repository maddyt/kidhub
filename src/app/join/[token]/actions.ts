'use server';
import { redirect } from 'next/navigation';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server.ts';
import { allow, clientIp, LIMITS, TOO_MANY } from '@/lib/security/rate-limit.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

async function accept(token: string): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('accept_invitation', { p_token: token });
  if (error) return { error: error.message };
  redirect('/');
}

export async function acceptAsCurrentUser(_: ActionResult, form: FormData): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await allow(`accept:${user?.id ?? await clientIp()}`, LIMITS.acceptUser))) return { error: TOO_MANY };
  return accept(String(form.get('token')));
}

/** New account from an invitation. Only possible while the invitation is valid and unused. */
export async function joinWithNewAccount(_: ActionResult, form: FormData): Promise<ActionResult> {
  const token = String(form.get('token'));
  const full_name = String(form.get('full_name') ?? '').trim();
  const password = String(form.get('password') ?? '');

  if (!(await allow(`join:ip:${await clientIp()}`, LIMITS.joinIp))) return { error: TOO_MANY };
  const supabase = await supabaseServer();
  const { data: preview } = await supabase.rpc('invitation_preview', { p_token: token });
  const inv = preview?.[0];
  if (!inv || inv.expired || inv.accepted) return { error: 'This invitation is no longer valid. Ask the school for a new link.' };
  // The account is always created for the address the school invited; whoever holds the link can't pick another.
  if (!inv.email) return { error: 'This invitation link is out of date. Ask the school for a new one.' };
  const email = String(inv.email).toLowerCase();
  if (!full_name) return { error: 'Please enter your name.' };
  if (password.length < 10) return { error: 'Use a password of at least 10 characters.' };

  const created = await supabaseAdmin().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
  if (created.error) {
    return { error: /already/i.test(created.error.message)
      ? 'An account with that email already exists. Sign in first, then open this link again.'
      : created.error.message };
  }
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) return { error: signIn.error.message };
  return accept(token);
}
