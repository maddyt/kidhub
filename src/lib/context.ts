import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseServer } from './supabase/server.ts';

export type Role = 'owner' | 'director' | 'teacher';

export interface School {
  id: string; org_id: string; name: string; timezone: string; address: string | null;
  opens_at: string; closes_at: string; require_photo_approval: boolean;
}
export interface StaffSchool extends School { role: Role }

export interface Ctx {
  userId: string;
  email: string;
  fullName: string;
  /** Schools where the user is owner, director or teacher. */
  schools: StaffSchool[];
  /** The school the staff UI is currently showing. */
  school: StaffSchool | null;
  role: Role | null;
  isAdmin: boolean;
  isStaff: boolean;
  ownedOrgIds: string[];
  /** Children this user is a guardian of (any access level). */
  guardianOf: { child_id: string; access: 'full' | 'video_only' }[];
  isFamily: boolean;
}

export const SCHOOL_COOKIE = 'kh_school';

export const getContext = cache(async (): Promise<Ctx | null> => {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, owners, staff, schools, guardians] = await Promise.all([
    supabase.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle(),
    supabase.from('org_owners').select('org_id').eq('profile_id', user.id),
    supabase.from('school_staff').select('school_id, role').eq('profile_id', user.id),
    supabase.from('schools').select('id, org_id, name, timezone, address, opens_at, closes_at, require_photo_approval').order('name'),
    supabase.from('guardians').select('child_id, access').eq('profile_id', user.id),
  ]);

  const ownedOrgIds = (owners.data ?? []).map((o) => o.org_id as string);
  const staffRole = new Map((staff.data ?? []).map((s) => [s.school_id as string, s.role as Role]));
  const staffSchools: StaffSchool[] = [];
  for (const s of (schools.data ?? []) as School[]) {
    const role: Role | undefined = ownedOrgIds.includes(s.org_id) ? 'owner' : staffRole.get(s.id);
    if (role) staffSchools.push({ ...s, role });
  }

  const wanted = (await cookies()).get(SCHOOL_COOKIE)?.value;
  const school = staffSchools.find((s) => s.id === wanted) ?? staffSchools[0] ?? null;
  const role = school?.role ?? null;
  const guardianOf = (guardians.data ?? []) as Ctx['guardianOf'];

  return {
    userId: user.id,
    email: user.email ?? '',
    fullName: (profile.data?.full_name as string) || user.email || 'You',
    schools: staffSchools,
    school,
    role,
    isAdmin: role === 'owner' || role === 'director',
    isStaff: role !== null,
    ownedOrgIds,
    guardianOf,
    isFamily: guardianOf.length > 0,
  };
});

export async function requireUser(): Promise<Ctx> {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  return ctx;
}

export async function requireStaff(): Promise<Ctx & { school: StaffSchool; role: Role }> {
  const ctx = await requireUser();
  if (!ctx.school || !ctx.role) redirect(ctx.isFamily ? '/family' : '/welcome');
  return ctx as Ctx & { school: StaffSchool; role: Role };
}

export async function requireAdmin() {
  const ctx = await requireStaff();
  if (!ctx.isAdmin) redirect('/dashboard');
  return ctx;
}

export async function requireFamily(): Promise<Ctx> {
  const ctx = await requireUser();
  if (!ctx.isFamily) redirect(ctx.isStaff ? '/dashboard' : '/welcome');
  return ctx;
}

/** Schools whose alerts this user should see: every school they administer, else just the current one. */
export function alertScope(ctx: Ctx): StaffSchool[] {
  const admin = ctx.schools.filter((s) => s.role !== 'teacher');
  return admin.length ? admin : ctx.school ? [ctx.school] : [];
}
