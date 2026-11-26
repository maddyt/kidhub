import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateManifest } from '../ai/packets.ts';
import { compilePacketPdf } from '../pdf/packet-compiler.ts';
import { createPacketRequest, markCompiled, markFailed, markManifestReady, uploadPacketPdf } from '../data/packets.ts';
import type { Plane, Subject } from '../domain/packets.ts';

export interface RunPacketPipelineInput {
  schoolId: string; schoolName?: string; childId: string | null; requestedBy: string;
  topic: string; plane: Plane; subject: Subject;
}

export type RunPacketPipelineResult = { ok: true; id: string } | { ok: false; id: string | null; error: string };

/**
 * The whole three-subsystem pipeline, run synchronously in one request: Subsystem A (manifest),
 * Subsystem C (PDF compile — text-only until an image provider exists, see src/lib/images/provider.ts).
 * A Vercel function can afford this because, without Subsystem B's image calls, it finishes in a
 * few seconds; once illustrations are wired in this should move to a background job instead.
 */
export async function runPacketPipeline(supabase: SupabaseClient, input: RunPacketPipelineInput): Promise<RunPacketPipelineResult> {
  const created = await createPacketRequest(supabase, {
    school_id: input.schoolId, child_id: input.childId, requested_by: input.requestedBy,
    topic: input.topic, developmental_plane: input.plane, subject_category: input.subject,
  });
  if ('error' in created) return { ok: false, id: null, error: created.error };
  const { id } = created;

  const manifestResult = await generateManifest(input.topic, input.plane, input.subject);
  if (!manifestResult.ok) { await markFailed(supabase, id, manifestResult.error); return { ok: false, id, error: manifestResult.error }; }
  await markManifestReady(supabase, id, manifestResult.manifest);

  try {
    const { bytes, pageCount } = await compilePacketPdf(manifestResult.manifest, input.schoolName);
    const path = await uploadPacketPdf(supabase, input.schoolId, id, bytes);
    await markCompiled(supabase, id, path, pageCount);
    return { ok: true, id };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'PDF compilation failed.';
    await markFailed(supabase, id, message);
    return { ok: false, id, error: message };
  }
}
