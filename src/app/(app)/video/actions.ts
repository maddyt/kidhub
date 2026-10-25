'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

export async function addCamera(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await supabaseServer();
  const name = String(form.get('name') ?? '').trim(), url = String(form.get('stream_url') ?? '').trim();
  if (!name || !(/^https:\/\//.test(url) || /^mux:[A-Za-z0-9]+$/.test(url))) return { error: 'Give the camera a name and an https:// stream URL (.m3u8) or mux:PLAYBACK_ID.' };
  const { data, error } = await supabase.from('cameras').insert({
    school_id: ctx.school.id, name, stream_url: url, classroom_id: String(form.get('classroom_id') || '') || null,
  }).select('id').single();
  if (error) return { error: error.message };
  // Default schedule: weekdays during opening hours. Edit below.
  await supabase.from('video_windows').insert({ camera_id: data.id, days: [1, 2, 3, 4, 5], start_time: ctx.school.opens_at, end_time: ctx.school.closes_at });
  revalidatePath('/video');
  return { ok: true };
}

export async function updateCamera(form: FormData) {
  await requireAdmin();
  const supabase = await supabaseServer();
  const id = String(form.get('id'));
  if (form.get('delete')) await supabase.from('cameras').delete().eq('id', id);
  else await supabase.from('cameras').update({ active: form.get('active') === 'true' }).eq('id', id);
  revalidatePath('/video');
}

export async function addWindow(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await supabaseServer();
  const days = form.getAll('days').map(Number).filter((d) => d >= 0 && d <= 6);
  const start_time = String(form.get('start_time')), end_time = String(form.get('end_time'));
  if (!days.length) return { error: 'Pick at least one day.' };
  if (!(end_time > start_time)) return { error: 'End time must be after start time.' };
  const { error } = await supabase.from('video_windows').insert({ camera_id: String(form.get('camera_id')), days, start_time, end_time });
  if (error) return { error: error.message };
  revalidatePath('/video');
  return { ok: true };
}

export async function deleteWindow(form: FormData) {
  await requireAdmin();
  const supabase = await supabaseServer();
  await supabase.from('video_windows').delete().eq('id', String(form.get('id')));
  revalidatePath('/video');
}
