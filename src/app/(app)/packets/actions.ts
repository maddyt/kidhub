'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { allow, LIMITS, TOO_MANY } from '@/lib/security/rate-limit.ts';
import { PLANES, SUBJECTS, type Plane, type Subject } from '@/lib/domain/packets.ts';
import { runPacketPipeline } from '@/lib/packets/pipeline.ts';
import { getPacketRequest } from '@/lib/data/packets.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

export async function requestPacket(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireStaff();
  const topic = String(form.get('topic') ?? '').trim();
  const plane = String(form.get('developmental_plane') ?? '');
  const subject = String(form.get('subject_category') ?? '');
  const childId = String(form.get('child_id') ?? '').trim() || null;

  if (!topic) return { error: 'Describe what the child is curious about.' };
  if (topic.length > 200) return { error: 'Keep the topic under 200 characters.' };
  if (!PLANES.includes(plane as Plane)) return { error: 'Pick a developmental plane.' };
  if (!SUBJECTS.includes(subject as Subject)) return { error: 'Pick a subject area.' };
  if (!(await allow(`packet:${ctx.userId}`, LIMITS.packetUser))) return { error: TOO_MANY };

  const supabase = await supabaseServer();
  const result = await runPacketPipeline(supabase, {
    schoolId: ctx.school.id, schoolName: ctx.school.name, childId, requestedBy: ctx.userId,
    topic, plane: plane as Plane, subject: subject as Subject,
  });
  revalidatePath('/packets');
  if (!result.ok) return { error: `Could not finish this packet: ${result.error}` };
  return { ok: true, message: 'Packet compiled. Open it below to preview and print.' };
}

export async function deletePacketRequest(form: FormData) {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const id = String(form.get('id'));
  const row = await getPacketRequest(supabase, id);
  if (row?.pdf_path) await supabase.storage.from('packets').remove([row.pdf_path]);
  await supabase.from('packet_requests').delete().eq('id', id).eq('school_id', ctx.school.id);
  revalidatePath('/packets');
}
