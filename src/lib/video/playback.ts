import { createSign } from 'node:crypto';

export const PLAYBACK_TTL_SECONDS = 10 * 60;

/**
 * Turns a camera's stored source into a URL the viewer's player can use.
 *
 *  - "mux:<playbackId>" with MUX_SIGNING_KEY_ID + MUX_SIGNING_PRIVATE_KEY set: a Mux signed-playback URL that
 *    stops working after `ttlSeconds`, so a copied link is useless once the viewing window closes.
 *  - "mux:<playbackId>" without keys: Mux public playback.
 *  - Anything else (a plain https .m3u8): returned as is. Fine for demos; for real cameras use a provider with
 *    signed URLs (see docs/COMMERCIALIZATION.md §6.6).
 */
export function playbackUrl(source: string, ttlSeconds = PLAYBACK_TTL_SECONDS, now = Date.now()): { url: string; signed: boolean } {
  const mux = /^mux:([A-Za-z0-9]+)$/.exec(source.trim());
  if (!mux) return { url: source, signed: false };
  const playbackId = mux[1];
  const kid = process.env.MUX_SIGNING_KEY_ID, key = process.env.MUX_SIGNING_PRIVATE_KEY;
  if (!kid || !key) return { url: `https://stream.mux.com/${playbackId}.m3u8`, signed: false };
  const token = signRs256({ alg: 'RS256', typ: 'JWT', kid },
    { sub: playbackId, aud: 'v', exp: Math.floor(now / 1000) + ttlSeconds, kid }, decodeKey(key));
  return { url: `https://stream.mux.com/${playbackId}.m3u8?token=${token}`, signed: true };
}

/** Mux gives the private key base64-encoded; accept that or a raw PEM. */
function decodeKey(k: string): string {
  return k.includes('BEGIN') ? k.replace(/\\n/g, '\n') : Buffer.from(k, 'base64').toString('utf8');
}

export function signRs256(header: object, payload: object, pem: string): string {
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const input = `${enc(header)}.${enc(payload)}`;
  return `${input}.${createSign('RSA-SHA256').update(input).sign(pem).toString('base64url')}`;
}
