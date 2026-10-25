'use server';
import { redirect } from 'next/navigation';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

async function accept(token: string): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('accept_invitation', { p_token: token });
  if (error) return { error: error.message };
  redirect('/');
}

export async function acceptAsCurrentUser(_: ActionResult, form: FormData): Promise<ActionResult> {
  return accept(String(form.get('token')));
}

/** New account from an invitation. Only possible while the invitation is valid and unused. */
export async function joinWithNewAccount(_: ActionResult, form: FormData): Promise<ActionResult> {
  const token = String(form.get('token'));
  const full_name = String(form.get('full_name') ?? '').trim();
  const password = String(form.get('password') ?? '');
  let email = String(form.get('email') ?? '').trim().toLowerCase();

  const supabase = await supabaseServer();
  const { data: preview } = await supabase.rpc('invitation_preview', { p_token: token });
  const inv = preview?.[0];
  if (!inv || inv.expired || inv.accepted) return { error: 'This invitation is no longer valid. Ask the school for a new link.' };
  if (inv.email) email = String(inv.email).toLowerCase();
  if (!full_name || !email) return { error: 'Please enter your name and email.' };
  if (password.length < 8) return { error: 'Use a password of at least 8 characters.' };

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
