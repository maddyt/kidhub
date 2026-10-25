'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { env } from '@/lib/env.ts';
import { DEMO_ACCOUNTS } from '@/lib/demo.ts';
import { allow, clientIp, LIMITS, TOO_MANY } from '@/lib/security/rate-limit.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

/** Only same-site paths; rejects "//host" and "/\host", which browsers treat as other sites. */
function safeNext(next: FormDataEntryValue | null) {
  const n = String(next ?? '');
  return n.startsWith('/') && !n.startsWith('//') && !n.includes('\\') ? n : '/';
}

export async function login(_: ActionResult, form: FormData): Promise<ActionResult> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  // Every sign-in reaches Supabase from our servers, so its per-IP limits can't tell people apart: limit here.
  if (!(await allow(`login:ip:${await clientIp()}`, LIMITS.loginIp)) || !(await allow(`login:email:${email}`, LIMITS.loginEmail))) {
    return { error: TOO_MANY };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password: String(form.get('password') ?? '') });
  if (error) return { error: 'That email and password did not match. Check them and try again.' };
  redirect(safeNext(form.get('next')));
}

export async function demoLogin(form: FormData) {
  if (!env.demoMode()) redirect('/login');
  const account = DEMO_ACCOUNTS.find((a) => a.key === form.get('who'));
  if (!account) redirect('/login');
  if (!(await allow(`demo:ip:${await clientIp()}`, LIMITS.demoIp))) redirect('/login?demo=busy');
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: account.email, password: env.demoPassword() });
  if (error) redirect('/login?demo=missing');
  redirect('/');
}
