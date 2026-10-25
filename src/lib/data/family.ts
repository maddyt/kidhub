import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Ctx } from '../context.ts';

export interface FamilyChild {
  id: string; first_name: string; last_name: string; birth_date: string | null; allergies: string | null;
  school_id: string; school_name: string; timezone: string; classroom: string | null; access: 'full' | 'video_only';
}

/** The children this user is a guardian of, with their school's name and timezone. */
export async function loadFamilyChildren(supabase: SupabaseClient, ctx: Ctx): Promise<FamilyChild[]> {
  const ids = ctx.guardianOf.map((g) => g.child_id);
  if (!ids.length) return [];
  const { data } = await supabase.from('children')
    .select('id, first_name, last_name, birth_date, allergies, school_id, school:schools(name, timezone), classroom:classrooms(name)')
    .in('id', ids).order('first_name');
  const one = (x: any) => (Array.isArray(x) ? x[0] : x);
  return (data ?? []).map((c: any) => ({
    id: c.id, first_name: c.first_name, last_name: c.last_name, birth_date: c.birth_date, allergies: c.allergies,
    school_id: c.school_id, school_name: one(c.school)?.name ?? '', timezone: one(c.school)?.timezone ?? 'UTC',
    classroom: one(c.classroom)?.name ?? null, access: ctx.guardianOf.find((g) => g.child_id === c.id)?.access ?? 'video_only',
  }));
}
