'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';

export async function reviewPhoto(form: FormData) {
  await requireAdmin();
  const supabase = await supabaseServer();
  const id = String(form.get('id'));
  if (form.get('decision') === 'approve') {
    await supabase.from('activities').update({ approved: true }).eq('id', id);
  } else {
    const { data } = await supabase.from('activities').delete().eq('id', id).select('photo_path');
    if (data?.[0]?.photo_path) await supabase.storage.from('media').remove([data[0].photo_path]);
  }
  revalidatePath('/approvals'); revalidatePath('/dashboard');
}
