import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dayIn, dayBounds } from '../domain/time.ts';
import type { School } from '../context.ts';

export interface Classroom {
  id: string; school_id: string; name: string; age_group: string; ratio: number; capacity: number | null;
  diaper_interval_min: number | null; bottle_interval_min: number | null;
}
export interface Child {
  id: string; school_id: string; classroom_id: string | null; first_name: string; last_name: string;
  birth_date: string | null; status: string; allergies: string | null; medical_notes: string | null;
}
export interface AttendanceRow {
  id: string; child_id: string; day: string; check_in_at: string; check_out_at: string | null;
  dropped_off_by: string | null; picked_up_by: string | null;
}
export interface ActivityRow {
  id: string; child_id: string; type: string; occurred_at: string; note: string | null;
  details: Record<string, unknown>; photo_path: string | null; approved: boolean; created_by: string | null;
}

/** Everything a classroom screen needs for the school's current day. */
export async function loadToday(supabase: SupabaseClient, school: School, now = new Date()) {
  const today = dayIn(school.timezone, now);
  const { start, end } = dayBounds(today, school.timezone);
  const [classrooms, children, attendance, activities, shifts] = await Promise.all([
    supabase.from('classrooms').select('*').eq('school_id', school.id).order('name'),
    supabase.from('children').select('id, school_id, classroom_id, first_name, last_name, birth_date, status, allergies, medical_notes')
      .eq('school_id', school.id).eq('status', 'enrolled').order('first_name'),
    supabase.from('attendance').select('id, child_id, day, check_in_at, check_out_at, dropped_off_by, picked_up_by')
      .eq('school_id', school.id).eq('day', today),
    supabase.from('activities').select('id, child_id, type, occurred_at, note, details, photo_path, approved, created_by')
      .eq('school_id', school.id).gte('occurred_at', start.toISOString()).lt('occurred_at', end.toISOString())
      .order('occurred_at', { ascending: false }),
    supabase.from('shifts').select('id, profile_id, classroom_id, clock_in_at, profile:profiles(full_name)')
      .eq('school_id', school.id).is('clock_out_at', null),
  ]);
  const attendanceByChild = new Map((attendance.data ?? []).map((a) => [a.child_id as string, a as AttendanceRow]));
  return {
    today,
    classrooms: (classrooms.data ?? []) as Classroom[],
    children: (children.data ?? []) as Child[],
    attendanceByChild,
    activities: (activities.data ?? []) as ActivityRow[],
    shifts: (shifts.data ?? []).map((s: any) => ({
      id: s.id as string, profile_id: s.profile_id as string, classroom_id: s.classroom_id as string | null,
      clock_in_at: s.clock_in_at as string, name: (Array.isArray(s.profile) ? s.profile[0] : s.profile)?.full_name || 'Staff',
    })),
  };
}

export const isPresent = (a: AttendanceRow | undefined) => !!a && !a.check_out_at;
