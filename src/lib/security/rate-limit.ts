import 'server-only';
import { headers } from 'next/headers';
import { supabaseAdmin } from '../supabase/server.ts';

/** Caller's IP as seen by Vercel (first hop of x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

export const LIMITS = {
  loginIp: [30, 10 * 60], loginEmail: [10, 15 * 60], demoIp: [60, 10 * 60],
  signupIp: [5, 60 * 60], joinIp: [10, 60 * 60], acceptUser: [20, 60 * 60],
  demoSetupIp: [10, 60 * 60], forgotIp: [5, 60 * 60], forgotEmail: [3, 60 * 60],
  assistantUser: [40, 60 * 60], videoUser: [240, 60 * 60], mfaUser: [10, 10 * 60],
} as const satisfies Record<string, readonly [number, number]>;

/**
 * Counts one attempt against `key` and says whether it is allowed.
 * Fails open (allows) if the limiter itself is unavailable, e.g. before 0002_security.sql is applied,
 * so a database hiccup never locks every family out of check-in.
 */
export async function allow(key: string, [max, windowSeconds]: readonly [number, number]): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin().rpc('rate_limit_hit', { p_key: key, p_max: max, p_window_seconds: windowSeconds });
    if (error) { console.warn(`rate limiter unavailable (${error.message}); allowing ${key}`); return true; }
    return data !== false;
  } catch (e) {
    console.warn('rate limiter error; allowing', e);
    return true;
  }
}

export const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.';
