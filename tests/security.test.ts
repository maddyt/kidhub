import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { playbackUrl } from '../src/lib/video/playback.ts';
import { aalOf } from '../src/lib/security/mfa.ts';

test('plain HLS sources pass through unsigned', () => {
  assert.deepEqual(playbackUrl('https://cam.example/live.m3u8'), { url: 'https://cam.example/live.m3u8', signed: false });
});

test('Mux sources get a signed, expiring playback token', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.MUX_SIGNING_KEY_ID = 'key123';
  process.env.MUX_SIGNING_PRIVATE_KEY = Buffer.from(privateKey.export({ type: 'pkcs1', format: 'pem' })).toString('base64');
  const now = Date.UTC(2026, 9, 25, 12);
  const { url, signed } = playbackUrl('mux:AbC123', 600, now);
  assert.equal(signed, true);
  const m = /^https:\/\/stream\.mux\.com\/AbC123\.m3u8\?token=(.+)$/.exec(url);
  assert.ok(m, url);
  const [h, p, sig] = m![1].split('.');
  assert.ok(createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, Buffer.from(sig, 'base64url')), 'signature verifies');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url').toString()), { alg: 'RS256', typ: 'JWT', kid: 'key123' });
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  assert.equal(claims.sub, 'AbC123');
  assert.equal(claims.aud, 'v');
  assert.equal(claims.exp, now / 1000 + 600);
  delete process.env.MUX_SIGNING_KEY_ID; delete process.env.MUX_SIGNING_PRIVATE_KEY;
  assert.deepEqual(playbackUrl('mux:AbC123'), { url: 'https://stream.mux.com/AbC123.m3u8', signed: false });
});

test('assurance level is read from the access token', () => {
  const tok = (o: object) => `x.${Buffer.from(JSON.stringify(o)).toString('base64url')}.y`;
  assert.equal(aalOf(tok({ aal: 'aal2' })), 'aal2');
  assert.equal(aalOf(tok({ aal: 'aal1' })), 'aal1');
  assert.equal(aalOf('garbage'), 'aal1');
  assert.equal(aalOf(undefined), 'aal1');
});
