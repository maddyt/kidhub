'use server';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server.ts';
import { seedDemo, removeDemo } from '@/lib/demo-seed.ts';
import { env } from '@/lib/env.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

/** Creates or resets the demo from the browser, so no terminal is needed. Guarded by the owner sign-up code. */
export async function setupDemo(_: ActionResult, form: FormData): Promise<ActionResult> {
  if (!env.demoMode()) return { error: 'Demo mode is off. Set NEXT_PUBLIC_DEMO_MODE=true in Vercel and redeploy.' };
  const code = env.signupCode();
  if (!code) return { error: 'Set OWNER_SIGNUP_CODE in Vercel first; it protects this page.' };
  if (String(form.get('code') ?? '') !== code) return { error: 'That code does not match OWNER_SIGNUP_CODE.' };
  const password = env.demoPassword();
  if (password.length < 8) return { error: 'Set DEMO_PASSWORD (8+ characters) in Vercel and redeploy.' };

  try {
    const db = supabaseAdmin();
    if (form.get('remove')) { await removeDemo(db); return { ok: true, message: 'Demo data removed.' }; }
    await seedDemo(db, password);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: /relation .* does not exist|schema cache/i.test(msg)
      ? `The database tables are missing. Run supabase/migrations/0001_kidhub.sql in the Supabase SQL editor first. (${msg})`
      : `Demo setup failed: ${msg}` };
  }
  redirect('/login?demo=ready');
}
