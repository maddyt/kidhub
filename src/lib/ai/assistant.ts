import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env.ts';
import type { StaffSchool } from '../context.ts';
import { loadSnapshot } from '../data/snapshot.ts';
import { buildAlerts } from '../domain/alerts.ts';
import { dayIn, addDays, dayBounds, timeIn } from '../domain/time.ts';

const SYSTEM = `You are the operations assistant inside KidHub, software used by childcare center directors and owners.
You answer questions using only the JSON snapshot of the center's data provided in the user turn. It covers rosters,
classrooms and ratios, today's attendance, staff on shift, certifications, invoices, the last 30 days of attendance,
and rule-based alerts.

How to answer:
- Lead with the direct answer, then the specific children, staff, rooms or invoices behind it. Use names and amounts from the data.
- If the snapshot does not contain what is needed, say what is missing instead of guessing.
- Money is in cents in the data; present it as dollars.
- Keep it short: a few sentences or a compact list. Plain text with simple "-" bullets; no tables or headings.

Guardrail: you inform and flag; people decide. Never state that you changed, sent, charged or approved anything,
and do not make enrollment, disciplinary, medical or billing decisions. When asked what to do, offer options and
say who should decide. For anything about a child's immediate safety, tell the user to act through the center's
own procedures right away.`;

/** Compact, name-resolved snapshot of the schools this user administers. */
export async function buildAssistantContext(supabase: SupabaseClient, schools: StaffSchool[]) {
  const ids = schools.map((s) => s.id);
  const snap = await loadSnapshot(supabase, schools);
  const alerts = buildAlerts(snap);
  const earliest = schools.map((s) => dayBounds(addDays(dayIn(s.timezone), -30), s.timezone).start).sort((a, b) => +a - +b)[0];
  const [kids, att, waitlist, paid] = await Promise.all([
    supabase.from('children').select('id, school_id, classroom_id, first_name, last_name, birth_date, allergies, start_date').in('school_id', ids).eq('status', 'enrolled'),
    supabase.from('attendance').select('child_id, day, check_in_at, check_out_at').in('school_id', ids).gte('check_in_at', earliest?.toISOString() ?? new Date().toISOString()),
    supabase.from('children').select('school_id, first_name, last_name, created_at, classroom_id').in('school_id', ids).eq('status', 'waitlist'),
    supabase.from('invoices').select('school_id, amount_cents, paid_at, due_on').in('school_id', ids).eq('status', 'paid').gte('due_on', addDays(dayIn('UTC'), -90)),
  ]);
  const childName = new Map((kids.data ?? []).map((k) => [k.id, `${k.first_name} ${k.last_name}`]));
  const roomName = new Map(snap.classrooms.map((r) => [r.id, r.name]));
  const daysAttended = new Map<string, number>();
  for (const a of att.data ?? []) daysAttended.set(a.child_id, (daysAttended.get(a.child_id) ?? 0) + 1);

  return {
    generated_at: new Date().toISOString(),
    schools: schools.map((s) => ({
      name: s.name, timezone: s.timezone, local_date: dayIn(s.timezone), local_time: timeIn(s.timezone), hours: `${s.opens_at}-${s.closes_at}`,
      classrooms: snap.classrooms.filter((r) => r.school_id === s.id).map((r) => {
        const present = snap.openAttendance.filter((a) => a.day === dayIn(s.timezone) && (kids.data ?? []).find((k) => k.id === a.child_id)?.classroom_id === r.id).length;
        return { name: r.name, ratio: `1:${r.ratio}`, children_present: present, staff_present: snap.openShifts.filter((x) => x.classroom_id === r.id).length,
          enrolled: (kids.data ?? []).filter((k) => k.classroom_id === r.id).length };
      }),
      waitlist: (waitlist.data ?? []).filter((w) => w.school_id === s.id).map((w) => ({ name: `${w.first_name} ${w.last_name}`, added: String(w.created_at).slice(0, 10), room: w.classroom_id ? roomName.get(w.classroom_id) : null })),
    })),
    children: (kids.data ?? []).map((k) => ({
      name: `${k.first_name} ${k.last_name}`, school: schools.find((s) => s.id === k.school_id)?.name, room: k.classroom_id ? roomName.get(k.classroom_id) : null,
      birth_date: k.birth_date, allergies: k.allergies, started: k.start_date, days_attended_last_30: daysAttended.get(k.id) ?? 0,
      checked_in_now: snap.openAttendance.some((a) => a.child_id === k.id),
    })),
    open_invoices: snap.openInvoices.map((i) => ({ child: childName.get(i.child_id) ?? 'unknown', amount_cents: i.amount_cents, due_on: i.due_on, school: schools.find((s) => s.id === i.school_id)?.name })),
    paid_last_90_days: { count: (paid.data ?? []).length, on_time: (paid.data ?? []).filter((p) => String(p.paid_at).slice(0, 10) <= p.due_on).length },
    staff_on_shift: snap.openShifts.map((x) => ({ school: schools.find((s) => s.id === x.school_id)?.name, room: x.classroom_id ? roomName.get(x.classroom_id) : 'floating' })),
    certifications: snap.certifications.map((c) => ({ staff: c.staff_name, name: c.name, expires_on: c.expires_on })),
    alerts: alerts.map((a) => ({ severity: a.severity, category: a.category, title: a.title, detail: a.detail })),
  };
}

export async function askAssistant(question: string, context: unknown): Promise<string> {
  const client = new Anthropic({ apiKey: env.anthropicKey() });
  const response = await client.beta.messages.create({
    model: env.anthropicModel(),
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    // If the primary model declines a request, the API retries on a suitable fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `<center_data>\n${JSON.stringify(context)}\n</center_data>\n\nQuestion: ${question}`,
    }],
  });
  if (response.stop_reason === 'refusal') return 'The assistant could not answer that question. Try rephrasing it.';
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();
  return text || 'No answer was returned.';
}
