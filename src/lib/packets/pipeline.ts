import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateManifest } from '../ai/packets.ts';
import { compilePacketPdf } from '../pdf/packet-compiler.ts';
import { createPacketRequest, markCompiled, markFailed, markManifestReady, uploadPacketPdf } from '../data/packets.ts';
import { generateIllustrations } from './illustrations.ts';
import type { Plane, Subject } from '../domain/packets.ts';

export interface RunPacketPipelineInput {
  schoolId: string; schoolName?: string; childId: string | null; requestedBy: string;
  topic: string; plane: Plane; subject: Subject;
}

export type RunPacketPipelineResult = { ok: true; id: string } | { ok: false; id: string | null; error: string };

/**
 * The whole three-subsystem pipeline, run synchronously in one request: Subsystem A (manifest),
 * Subsystem B (illustrations, parallelized and capped — see src/lib/packets/illustrations.ts;
 * a no-op if no provider is configured), Subsystem C (PDF compile). This still fits in one Vercel
 * function call because B runs in parallel rather than per-term in sequence, but it's close:
 * the route exports `maxDuration = 60` (src/app/(app)/packets/actions.ts and family/packets/
 * actions.ts) to give the manifest call and the illustration batch room. If packets start timing
 * out, split this into a background job instead of raising that further.
 */
export async function runPacketPipeline(supabase: SupabaseClient, input: RunPacketPipelineInput): Promise<RunPacketPipelineResult> {
  const created = await createPacketRequest(supabase, {
    school_id: input.schoolId, child_id: input.childId, requested_by: input.requestedBy,
    topic: input.topic, developmental_plane: input.plane, subject_category: input.subject,
  });
  if ('error' in created) return { ok: false, id: null, error: created.error };
  const { id } = created;

  // Belt and suspenders: generateManifest and compilePacketPdf already turn their own failures
  // into a result rather than throwing, but a request should never crash the page it was made
  // from — any surprise here still ends the request as "failed" instead of an unhandled 500.
  try {
    const manifestResult = await generateManifest(input.topic, input.plane, input.subject);
    if (!manifestResult.ok) { await markFailed(supabase, id, manifestResult.error); return { ok: false, id, error: manifestResult.error }; }
    await markManifestReady(supabase, id, manifestResult.manifest);

    const illustrations = await generateIllustrations(supabase, input.schoolId, id, manifestResult.manifest);

    const { bytes, pageCount } = await compilePacketPdf(manifestResult.manifest, input.schoolName, illustrations);
    const path = await uploadPacketPdf(supabase, input.schoolId, id, bytes);
    await markCompiled(supabase, id, path, pageCount);
    return { ok: true, id };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Something went wrong compiling this packet.';
    await markFailed(supabase, id, message);
    return { ok: false, id, error: message };
  }
}
