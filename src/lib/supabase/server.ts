import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { env } from '../env.ts';

/** Supabase client acting as the signed-in user. Row-level security applies to everything it does. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { for (const { name, value, options } of list) store.set(name, value, options); }
        catch { /* called from a Server Component; middleware refreshes the session instead */ }
      },
    },
  });
}

/**
 * Service-role client that bypasses RLS. Only for flows that cannot run as a user:
 * creating accounts, creating an organization, the billing cron and the demo seed.
 */
export function supabaseAdmin() {
  return createAdmin(env.supabaseUrl(), env.serviceRoleKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}
