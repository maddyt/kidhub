// Proactive alerts across safety, care, billing and compliance.
// Rule-based and explainable: every alert says exactly which record triggered it.
// Guardrail: alerts flag; people decide. Nothing here changes data.
import { careTimers } from './care.ts';
import { ratioStatus } from './ratios.ts';
import { dayIn, timeIn, addDays } from './time.ts';
import { money } from './billing.ts';

export type Severity = 'critical' | 'warning' | 'info';
export type Category = 'safety' | 'care' | 'billing' | 'compliance' | 'family';

export interface Alert {
  id: string; severity: Severity; category: Category; school_id: string;
  title: string; detail: string; href: string;
}

export interface Snapshot {
  now: Date;
  schools: { id: string; name: string; timezone: string; closes_at: string }[];
  classrooms: { id: string; school_id: string; name: string; ratio: number; diaper_interval_min: number | null; bottle_interval_min: number | null }[];
  children: { id: string; school_id: string; classroom_id: string | null; first_name: string; last_name: string }[];
  openAttendance: { child_id: string; school_id: string; day: string; check_in_at: string }[];
  activitiesToday: { child_id: string; type: string; occurred_at: string }[];
  openShifts: { profile_id: string; school_id: string; classroom_id: string | null }[];
  openInvoices: { id: string; school_id: string; child_id: string; amount_cents: number; due_on: string }[];
  certifications: { id: string; school_id: string; staff_name: string; name: string; expires_on: string | null }[];
  pendingPhotos: { school_id: string; count: number }[];
  pendingVideoApprovals: { school_id: string; child_id: string; guardian_name: string }[];
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
export const CERT_WARNING_DAYS = 30;

export function buildAlerts(s: Snapshot): Alert[] {
  const alerts: Alert[] = [];
  const school = new Map(s.schools.map((x) => [x.id, x]));
  const child = new Map(s.children.map((c) => [c.id, c]));
  const name = (id: string) => { const c = child.get(id); return c ? `${c.first_name} ${c.last_name}` : 'A child'; };

  // Safety: children still checked in after closing, or from a previous day.
  for (const a of s.openAttendance) {
    const sc = school.get(a.school_id); if (!sc) continue;
    const today = dayIn(sc.timezone, s.now);
    const late = a.day < today || timeIn(sc.timezone, s.now) >= sc.closes_at.slice(0, 5);
    if (late) alerts.push({
      id: `checkout:${a.child_id}:${a.day}`, severity: 'critical', category: 'safety', school_id: a.school_id,
      title: `${name(a.child_id)} was never checked out`,
      detail: a.day < today ? `Checked in on ${a.day} with no check-out recorded.` : `Still checked in after closing (${sc.closes_at.slice(0, 5)}).`,
      href: '/attendance',
    });
  }

  // Children here right now: open check-ins from today (a stale row from a previous day is a
  // missed check-out, flagged above, not a child in the room).
  const presentToday = s.openAttendance.filter((a) => {
    const sc = school.get(a.school_id);
    return sc && a.day === dayIn(sc.timezone, s.now);
  });

  // Safety: ratio compliance per classroom, based on who is actually checked in and clocked in.
  for (const room of s.classrooms) {
    const present = presentToday.filter((a) => child.get(a.child_id)?.classroom_id === room.id).length;
    if (!present) continue;
    const staff = s.openShifts.filter((x) => x.classroom_id === room.id).length;
    const r = ratioStatus(present, staff, room.ratio);
    if (!r.ok) alerts.push({
      id: `ratio:${room.id}`, severity: 'critical', category: 'safety', school_id: room.school_id,
      title: `${room.name} is out of ratio`,
      detail: `${present} children with ${staff} staff clocked in; 1:${room.ratio} requires ${r.requiredStaff}.`,
      href: '/staff',
    });
  }

  // Care: overdue diapers / bottles for checked-in children.
  const room = new Map(s.classrooms.map((r) => [r.id, r]));
  for (const a of presentToday) {
    const c = child.get(a.child_id); const cr = c?.classroom_id ? room.get(c.classroom_id) : undefined;
    if (!cr) continue;
    const acts = s.activitiesToday.filter((x) => x.child_id === a.child_id);
    for (const t of careTimers(acts, a.check_in_at, cr, s.now)) {
      if (t.state !== 'overdue') continue;
      alerts.push({
        id: `care:${t.kind}:${a.child_id}`, severity: 'warning', category: 'care', school_id: a.school_id,
        title: `${name(a.child_id)}: ${t.kind} overdue`,
        detail: `${t.minutesSince} min since ${t.lastAt ? `last ${t.kind}` : 'check-in'} (every ${t.interval} min in ${cr.name}).`,
        href: '/log',
      });
    }
  }

  // Billing: overdue tuition, grouped per child.
  const overdue = new Map<string, { school_id: string; cents: number; count: number; oldest: string }>();
  for (const inv of s.openInvoices) {
    const sc = school.get(inv.school_id); if (!sc) continue;
    if (inv.due_on >= dayIn(sc.timezone, s.now)) continue;
    const cur = overdue.get(inv.child_id) ?? { school_id: inv.school_id, cents: 0, count: 0, oldest: inv.due_on };
    cur.cents += inv.amount_cents; cur.count++; if (inv.due_on < cur.oldest) cur.oldest = inv.due_on;
    overdue.set(inv.child_id, cur);
  }
  for (const [childId, o] of overdue) alerts.push({
    id: `overdue:${childId}`, severity: 'warning', category: 'billing', school_id: o.school_id,
    title: `${name(childId)}: ${money(o.cents)} overdue`,
    detail: `${o.count} unpaid invoice${o.count > 1 ? 's' : ''}, oldest due ${o.oldest}.`,
    href: '/billing',
  });

  // Compliance: expired or soon-expiring staff certifications.
  for (const c of s.certifications) {
    if (!c.expires_on) continue;
    const sc = school.get(c.school_id); if (!sc) continue;
    const today = dayIn(sc.timezone, s.now);
    if (c.expires_on < today) alerts.push({
      id: `cert:${c.id}`, severity: 'critical', category: 'compliance', school_id: c.school_id,
      title: `${c.staff_name}'s ${c.name} has expired`, detail: `Expired ${c.expires_on}.`, href: '/staff',
    });
    else if (c.expires_on <= addDays(today, CERT_WARNING_DAYS)) alerts.push({
      id: `cert:${c.id}`, severity: 'warning', category: 'compliance', school_id: c.school_id,
      title: `${c.staff_name}'s ${c.name} expires soon`, detail: `Expires ${c.expires_on}.`, href: '/staff',
    });
  }

  // Family: things waiting on a director.
  for (const p of s.pendingPhotos) if (p.count > 0) alerts.push({
    id: `photos:${p.school_id}`, severity: 'info', category: 'family', school_id: p.school_id,
    title: `${p.count} photo${p.count > 1 ? 's' : ''} awaiting approval`, detail: 'Families see photos once approved.', href: '/approvals',
  });
  for (const v of s.pendingVideoApprovals) alerts.push({
    id: `video:${v.child_id}:${v.guardian_name}`, severity: 'info', category: 'family', school_id: v.school_id,
    title: `${v.guardian_name} is waiting for video access`, detail: `Family member of ${name(v.child_id)}.`, href: '/approvals',
  });

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.title.localeCompare(b.title));
}
