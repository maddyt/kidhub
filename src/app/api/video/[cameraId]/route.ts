import { NextResponse } from 'next/server';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server.ts';
import { playbackUrl, PLAYBACK_TTL_SECONDS } from '@/lib/video/playback.ts';
import { allow, LIMITS } from '@/lib/security/rate-limit.ts';

export const dynamic = 'force-dynamic';
const deny = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { 'cache-control': 'no-store' } });

/**
 * Issues a short-lived playback link for one camera. Called when a player starts and again before the link
 * expires, so access ends soon after a viewing window closes or approval is revoked.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ cameraId: string }> }) {
  const { cameraId } = await params;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return deny(401, 'signed_out');
  if (!(await allow(`video:${user.id}`, LIMITS.videoUser))) return deny(429, 'too_many');

  // Families: the database decides (approved, right room, inside a window). Admins may preview their own cameras.
  const { data: feeds } = await supabase.rpc('my_video_feeds');
  const feed = (feeds ?? []).find((f: { camera_id: string }) => f.camera_id === cameraId);
  let preview = false;
  if (!feed) {
    const { data: own } = await supabase.from('cameras').select('id').eq('id', cameraId).maybeSingle();
    if (!own) return deny(403, 'not_available');
    preview = true;
  }

  const { data: cam } = await supabaseAdmin().from('cameras').select('stream_url, school_id, name').eq('id', cameraId).single();
  if (!cam) return deny(404, 'not_found');
  // Viewer audit trail (no-op until 0002_security.sql is applied).
  await supabase.rpc('log_event', { p_school: cam.school_id, p_entity: 'camera', p_action: preview ? 'preview' : 'view', p_entity_id: cameraId, p_detail: cam.name });

  const { url, signed } = playbackUrl(cam.stream_url);
  return NextResponse.json({ url, signed, expiresIn: PLAYBACK_TTL_SECONDS }, { headers: { 'cache-control': 'no-store' } });
}
