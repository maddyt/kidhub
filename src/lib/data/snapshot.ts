import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Snapshot } from '../domain/alerts.ts';
import { dayIn, dayBounds, addDays } from '../domain/time.ts';
import type { School } from '../context.ts';

/** Load everything the alert rules need for `schools`, as the current user (RLS applies). */
export async function loadSnapshot(supabase: SupabaseClient, schools: School[], now = new Date()): Promise<Snapshot> {
  const ids = schools.map((s) => s.id);
  if (!ids.length) {
    return { now, schools: [], classrooms: [], children: [], openAttendance: [], activitiesToday: [], openShifts: [],
      openInvoices: [], certifications: [], pendingPhotos: [], pendingVideoApprovals: [] };
  }
  // Earliest start of "today" across the schools' timezones, so one query covers them all.
  const since = schools.map((s) => dayBounds(dayIn(s.timezone, now), s.timezone).start).sort((a, b) => +a - +b)[0];

  const [classrooms, children, attendance, activities, shifts, invoices, certs, photos, guardians] = await Promise.all([
    supabase.from('classrooms').select('id, school_id, name, ratio, diaper_interval_min, bottle_interval_min').in('school_id', ids),
    supabase.from('children').select('id, school_id, classroom_id, first_name, last_name').in('school_id', ids).eq('status', 'enrolled'),
    supabase.from('attendance').select('child_id, school_id, day, check_in_at').in('school_id', ids).is('check_out_at', null)
      .gte('day', addDays(dayIn('UTC', now), -7)),
    supabase.from('activities').select('child_id, type, occurred_at').in('school_id', ids).gte('occurred_at', since.toISOString())
      .in('type', ['diaper', 'potty', 'bottle']),
    supabase.from('shifts').select('profile_id, school_id, classroom_id').in('school_id', ids).is('clock_out_at', null),
    supabase.from('invoices').select('id, school_id, child_id, amount_cents, due_on').in('school_id', ids).eq('status', 'open'),
    supabase.from('certifications').select('id, school_id, name, expires_on, profile:profiles(full_name)').in('school_id', ids),
    supabase.from('activities').select('school_id').in('school_id', ids).eq('approved', false),
    supabase.from('guardians').select('child_id, video_approved, profile:profiles(full_name), child:children!inner(school_id)')
      .eq('video_approved', false).in('child.school_id', ids),
  ]);

  const photoCounts = new Map<string, number>();
  for (const p of photos.data ?? []) photoCounts.set(p.school_id, (photoCounts.get(p.school_id) ?? 0) + 1);
  const one = <T,>(x: T | T[] | null | undefined): T | undefined => (Array.isArray(x) ? x[0] : x ?? undefined);

  return {
    now,
    schools: schools.map((s) => ({ id: s.id, name: s.name, timezone: s.timezone, closes_at: s.closes_at })),
    classrooms: classrooms.data ?? [],
    children: children.data ?? [],
    openAttendance: attendance.data ?? [],
    activitiesToday: activities.data ?? [],
    openShifts: shifts.data ?? [],
    openInvoices: invoices.data ?? [],
    certifications: (certs.data ?? []).map((c: any) => ({
      id: c.id, school_id: c.school_id, name: c.name, expires_on: c.expires_on, staff_name: one<any>(c.profile)?.full_name || 'Staff member',
    })),
    pendingPhotos: [...photoCounts].map(([school_id, count]) => ({ school_id, count })),
    pendingVideoApprovals: (guardians.data ?? []).map((g: any) => ({
      school_id: one<any>(g.child)?.school_id, child_id: g.child_id, guardian_name: one<any>(g.profile)?.full_name || 'A family member',
    })),
  };
}
