import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison for secrets such as sign-up codes. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest(), hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
