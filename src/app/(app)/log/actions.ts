'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { uploadPhoto } from '@/lib/data/media.ts';
import { dayIn, dayBounds } from '@/lib/domain/time.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

const TYPES = new Set(['nap_start', 'nap_end', 'meal', 'bottle', 'diaper', 'potty', 'photo', 'note', 'observation', 'incident', 'medication']);
const DETAIL_KEYS = ['meal_type', 'amount', 'food', 'ounces', 'contents', 'kind', 'domain', 'medicine', 'dose'];

/** One entry, logged for every selected child. Feeds care timers, daily reports and alerts. */
export async function logActivity(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const type = String(form.get('type'));
  const childIds = form.getAll('child_id').map(String).filter(Boolean);
  if (!TYPES.has(type)) return { error: 'Pick what you are logging.' };
  if (!childIds.length) return { error: 'Select at least one child.' };

  const details: Record<string, string | number> = {};
  for (const k of DETAIL_KEYS) {
    const v = String(form.get(k) ?? '').trim();
    if (v) details[k] = k === 'ounces' ? Number(v) : v;
  }
  const note = String(form.get('note') ?? '').trim() || null;
  if ((type === 'note' || type === 'incident' || type === 'observation') && !note) return { error: 'Add a note describing it.' };

  // "HH:MM" today at the school, defaulting to now.
  let occurred_at = new Date().toISOString();
  const time = String(form.get('time') ?? '');
  if (/^\d{2}:\d{2}$/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    occurred_at = new Date(dayBounds(dayIn(ctx.school.timezone), ctx.school.timezone).start.getTime() + (h * 60 + m) * 60000).toISOString();
  }

  const file = form.get('photo');
  const hasPhoto = file instanceof File && file.size > 0;
  if (type === 'photo' && !hasPhoto) return { error: 'Choose a photo to share.' };
  if (hasPhoto && file.size > 7 * 1024 * 1024) return { error: 'Photos must be under 7 MB.' };
  const needsApproval = hasPhoto && ctx.school.require_photo_approval && !ctx.isAdmin;

  const batch_id = crypto.randomUUID();
  const rows = [];
  for (const child_id of childIds) {
    // Stored per child so each family can only ever read their own child's copy.
    const photo_path = hasPhoto ? await uploadPhoto(supabase, ctx.school.id, child_id, file as File) : null;
    rows.push({ child_id, school_id: ctx.school.id, type, occurred_at, details, note, photo_path,
      approved: !needsApproval, batch_id, created_by: ctx.userId });
  }
  const { error } = await supabase.from('activities').insert(rows);
  if (error) return { error: error.message };
  revalidatePath('/log'); revalidatePath('/dashboard');
  return { ok: true, message: `Logged for ${childIds.length} child${childIds.length > 1 ? 'ren' : ''}${needsApproval ? ' (photo awaiting director approval)' : ''}.` };
}

export async function deleteActivity(form: FormData) {
  await requireStaff();
  const supabase = await supabaseServer();
  const { data } = await supabase.from('activities').delete().eq('id', String(form.get('id'))).select('photo_path');
  const path = data?.[0]?.photo_path;
  if (path) await supabase.storage.from('media').remove([path]);
  revalidatePath('/log');
}
