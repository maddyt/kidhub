'use server';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { env } from '@/lib/env.ts';
import { DEMO_ACCOUNTS } from '@/lib/demo.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

function safeNext(next: FormDataEntryValue | null) {
  const n = String(next ?? '');
  return n.startsWith('/') && !n.startsWith('//') ? n : '/';
}

export async function login(_: ActionResult, form: FormData): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get('email') ?? '').trim(), password: String(form.get('password') ?? ''),
  });
  if (error) return { error: 'That email and password did not match. Check them and try again.' };
  redirect(safeNext(form.get('next')));
}

export async function demoLogin(form: FormData) {
  if (!env.demoMode()) redirect('/login');
  const account = DEMO_ACCOUNTS.find((a) => a.key === form.get('who'));
  if (!account) redirect('/login');
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: account.email, password: env.demoPassword() });
  if (error) redirect('/login?demo=missing');
  redirect('/');
}
