// Two-step verification policy.
import { env } from '../env.ts';
import { DEMO_ACCOUNTS } from '../demo.ts';

/** Demo accounts stay one-click so the public demo keeps working; they hold only fictional data. */
export function isDemoAccount(email: string | undefined | null): boolean {
  return env.demoMode() && !!email && DEMO_ACCOUNTS.some((a) => a.email === email.toLowerCase());
}

/** Owners and directors must use two-step verification unless REQUIRE_ADMIN_MFA=false. */
export function adminMfaRequired(): boolean {
  return process.env.REQUIRE_ADMIN_MFA !== 'false';
}

/** Reads the assurance level ("aal1" password only, "aal2" password + code) from a Supabase access token. */
export function aalOf(accessToken: string | undefined | null): 'aal1' | 'aal2' {
  try {
    const payload = JSON.parse(Buffer.from(String(accessToken).split('.')[1], 'base64url').toString());
    return payload.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch { return 'aal1'; }
}
