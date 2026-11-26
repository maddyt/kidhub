'use server';
import { revalidatePath } from 'next/cache';
import { requireFamily } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { allow, LIMITS, TOO_MANY } from '@/lib/security/rate-limit.ts';
import { PLANES, SUBJECTS, type Plane, type Subject } from '@/lib/domain/packets.ts';
import { runPacketPipeline } from '@/lib/packets/pipeline.ts';
import { getPacketRequest } from '@/lib/data/packets.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

// Generating illustrations (Subsystem B, parallelized but still real network calls) pushes this
// past Vercel's default 10s function limit; see the note on runPacketPipeline.
export const maxDuration = 60;

export async function requestFamilyPacket(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireFamily();
  const childId = String(form.get('child_id') ?? '').trim();
  const topic = String(form.get('topic') ?? '').trim();
  const plane = String(form.get('developmental_plane') ?? '');
  const subject = String(form.get('subject_category') ?? '');

  const guardian = ctx.guardianOf.find((g) => g.child_id === childId && g.access === 'full');
  if (!guardian) return { error: 'Choose one of your children.' };
  if (!topic) return { error: 'Describe what your child is curious about.' };
  if (topic.length > 200) return { error: 'Keep the topic under 200 characters.' };
  if (!PLANES.includes(plane as Plane)) return { error: 'Pick a developmental plane.' };
  if (!SUBJECTS.includes(subject as Subject)) return { error: 'Pick a subject area.' };
  if (!(await allow(`packet:${ctx.userId}`, LIMITS.packetUser))) return { error: TOO_MANY };

  const supabase = await supabaseServer();
  const { data: child } = await supabase.from('children').select('school_id').eq('id', childId).maybeSingle();
  if (!child) return { error: "Couldn't find that child." };

  const result = await runPacketPipeline(supabase, {
    schoolId: child.school_id, childId, requestedBy: ctx.userId,
    topic, plane: plane as Plane, subject: subject as Subject,
  });
  revalidatePath('/family/packets');
  if (!result.ok) return { error: `Could not finish this packet: ${result.error}` };
  return { ok: true, message: 'Packet compiled. Open it below to preview and print.' };
}

export async function deleteFamilyPacketRequest(form: FormData) {
  const ctx = await requireFamily();
  const supabase = await supabaseServer();
  const id = String(form.get('id'));
  const row = await getPacketRequest(supabase, id);
  if (!row || !ctx.guardianOf.some((g) => g.child_id === row.child_id && g.access === 'full')) return;
  if (row.pdf_path) await supabase.storage.from('packets').remove([row.pdf_path]);
  await supabase.from('packet_requests').delete().eq('id', id);
  revalidatePath('/family/packets');
}
