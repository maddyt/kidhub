'use server';
import { revalidatePath } from 'next/cache';
import { requireStaff } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { loadAuthorizedPickups } from '@/lib/data/people.ts';
import { dayIn } from '@/lib/domain/time.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

export async function checkIn(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const childId = String(form.get('child_id'));
  const { error } = await supabase.from('attendance').insert({
    child_id: childId, school_id: ctx.school.id, day: dayIn(ctx.school.timezone),
    check_in_by: ctx.userId, dropped_off_by: String(form.get('dropped_off_by') || '') || null,
  });
  if (error) return { error: error.code === '23505' ? 'Already checked in today.' : error.message };
  revalidatePath('/attendance'); revalidatePath('/dashboard');
  return { ok: true };
}

export async function checkOut(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const childId = String(form.get('child_id'));
  const who = String(form.get('picked_up_by') ?? '').trim();
  if (!who) return { error: 'Choose who is picking up.' };

  // Approved pickup validation happens here on the server, against the current list.
  const allowed = (await loadAuthorizedPickups(supabase, [childId])).get(childId) ?? [];
  if (!allowed.some((p) => p.name.toLowerCase() === who.toLowerCase())) {
    return { error: `${who} is not on the approved pickup list. Do not release the child; a director must add them first.` };
  }
  const { error, count } = await supabase.from('attendance')
    .update({ check_out_at: new Date().toISOString(), check_out_by: ctx.userId, picked_up_by: who }, { count: 'exact' })
    .eq('child_id', childId).eq('day', dayIn(ctx.school.timezone)).is('check_out_at', null);
  if (error) return { error: error.message };
  if (!count) return { error: 'This child is not checked in.' };
  revalidatePath('/attendance'); revalidatePath('/dashboard');
  return { ok: true };
}

/** Close a check-in left open from a previous day (fixes a "never checked out" alert). */
export async function closeStale(form: FormData) {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  await supabase.from('attendance')
    .update({ check_out_at: new Date().toISOString(), check_out_by: ctx.userId, picked_up_by: 'Closed by staff (missed check-out)' })
    .eq('id', String(form.get('id'))).is('check_out_at', null);
  revalidatePath('/attendance'); revalidatePath('/dashboard');
}

export async function undoAttendance(form: FormData) {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const childId = String(form.get('child_id'));
  const day = dayIn(ctx.school.timezone);
  if (form.get('what') === 'checkout') {
    await supabase.from('attendance').update({ check_out_at: null, check_out_by: null, picked_up_by: null }).eq('child_id', childId).eq('day', day);
  } else {
    await supabase.from('attendance').delete().eq('child_id', childId).eq('day', day);
  }
  revalidatePath('/attendance'); revalidatePath('/dashboard');
}
