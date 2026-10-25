'use server';
import { revalidatePath } from 'next/cache';
import { requireFamily } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { EMAIL_RE } from '@/lib/security/compare.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

/** A parent invites a grandparent (or deployed parent) with video-only access. The school still approves video. */
export async function inviteSubUser(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireFamily();
  const supabase = await supabaseServer();
  const child_id = String(form.get('child_id'));
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: 'Enter their email. Only that address can use the link.' };
  const { data: child } = await supabase.from('children').select('school_id').eq('id', child_id).maybeSingle();
  if (!child) return { error: 'Child not found.' };
  const { error } = await supabase.from('invitations').insert({
    school_id: child.school_id, role: 'guardian', child_id, access: 'video_only', created_by: ctx.userId,
    relationship: String(form.get('relationship') || 'family'), email,
  });
  if (error) return { error: error.message };
  revalidatePath('/family/people');
  return { ok: true, message: 'Link created below. Send it to them.' };
}
