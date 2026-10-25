'use server';
import { redirect } from 'next/navigation';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server.ts';
import { env } from '@/lib/env.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

/** Create an owner account plus the organization and its first school. */
export async function signupOwner(_: ActionResult, form: FormData): Promise<ActionResult> {
  const code = env.signupCode();
  if (!code) return { error: 'Sign-up is disabled. Set OWNER_SIGNUP_CODE on the server to enable it.' };
  if (String(form.get('code') ?? '') !== code) return { error: 'That sign-up code is not correct.' };

  const full_name = String(form.get('full_name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const org = String(form.get('org') ?? '').trim();
  const school = String(form.get('school') ?? '').trim();
  const tz = String(form.get('timezone') ?? 'America/Los_Angeles');
  if (!full_name || !email || !org || !school) return { error: 'Please fill in every field.' };
  if (password.length < 8) return { error: 'Use a password of at least 8 characters.' };

  const admin = supabaseAdmin();
  // email_confirm: true lets people sign in immediately without Supabase sending email.
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } });
  if (created.error || !created.data.user) return { error: created.error?.message ?? 'Could not create the account.' };
  const { error } = await admin.rpc('create_organization', { p_owner: created.data.user.id, p_org_name: org, p_school_name: school, p_timezone: tz });
  if (error) return { error: error.message };

  const supabase = await supabaseServer();
  await supabase.auth.signInWithPassword({ email, password });
  redirect('/settings?welcome=1');
}
