'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { SCHOOL_COOKIE } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';

export async function switchSchool(id: string) {
  (await cookies()).set(SCHOOL_COOKIE, id, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/', 'layout');
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}
