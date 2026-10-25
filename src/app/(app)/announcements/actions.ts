'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

export async function postAnnouncement(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await supabaseServer();
  const title = String(form.get('title') ?? '').trim(), body = String(form.get('body') ?? '').trim();
  if (!title || !body) return { error: 'Add a title and a message.' };
  const kind = ['info', 'closure', 'emergency'].includes(String(form.get('kind'))) ? String(form.get('kind')) : 'info';
  // "All my schools" posts the same announcement to every school this admin runs.
  const targets = form.get('all') === 'on' ? ctx.schools.filter((s) => s.role !== 'teacher').map((s) => s.id) : [ctx.school.id];
  const { error } = await supabase.from('announcements').insert(targets.map((school_id) => ({ school_id, title, body, kind, created_by: ctx.userId })));
  if (error) return { error: error.message };
  revalidatePath('/announcements');
  return { ok: true, message: `Posted to ${targets.length} school${targets.length > 1 ? 's' : ''}.` };
}

export async function deleteAnnouncement(form: FormData) {
  await requireAdmin();
  const supabase = await supabaseServer();
  await supabase.from('announcements').delete().eq('id', String(form.get('id')));
  revalidatePath('/announcements');
}
