// Daily report: assembled from the same entries teachers already logged (no second data entry).
import { formatTime, minutesBetween } from './time.ts';

export interface ReportActivity {
  id: string; type: string; occurred_at: string; note: string | null;
  details: Record<string, unknown>; photo_url?: string | null;
}

export interface DailyReport {
  summary: { meals: number; bottles: number; bottleOz: number; diapers: number; napMinutes: number; photos: number };
  naps: { start: string; end: string | null; minutes: number | null }[];
  timeline: { id: string; time: string; type: string; label: string; note: string | null; photo_url?: string | null }[];
}

export const ACTIVITY_LABELS: Record<string, string> = {
  nap_start: 'Fell asleep', nap_end: 'Woke up', meal: 'Meal', bottle: 'Bottle', diaper: 'Diaper',
  potty: 'Potty', photo: 'Photo', note: 'Note', observation: 'Milestone', incident: 'Incident report',
  medication: 'Medication',
};

export const ACTIVITY_ICONS: Record<string, string> = {
  nap_start: '😴', nap_end: '🌤️', meal: '🍎', bottle: '🍼', diaper: '🧷', potty: '🚽',
  photo: '📷', note: '📝', observation: '🌱', incident: '🩹', medication: '💊',
};

export function describe(a: Pick<ReportActivity, 'type' | 'details'>): string {
  const d = a.details ?? {};
  const base = ACTIVITY_LABELS[a.type] ?? a.type;
  switch (a.type) {
    case 'meal': return [d.meal_type ? `${cap(String(d.meal_type))}` : base, d.amount ? `ate ${d.amount}` : null, d.food ? `(${d.food})` : null].filter(Boolean).join(' ');
    case 'bottle': return `${base}${d.ounces ? ` · ${d.ounces} oz` : ''}${d.contents ? ` ${d.contents}` : ''}`;
    case 'diaper': return `${base}${d.kind ? ` · ${d.kind}` : ''}`;
    case 'potty': return `${base}${d.kind ? ` · ${d.kind}` : ''}`;
    case 'observation': return `${base}${d.domain ? ` · ${d.domain}` : ''}`;
    case 'medication': return `${base}${d.medicine ? ` · ${d.medicine}` : ''}${d.dose ? ` (${d.dose})` : ''}`;
    default: return base;
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function dailyReport(activities: ReportActivity[], tz: string): DailyReport {
  const sorted = [...activities].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const naps: DailyReport['naps'] = [];
  let open: string | null = null;
  for (const a of sorted) {
    if (a.type === 'nap_start') open = a.occurred_at;
    if (a.type === 'nap_end' && open) {
      naps.push({ start: open, end: a.occurred_at, minutes: minutesBetween(open, a.occurred_at) });
      open = null;
    }
  }
  if (open) naps.push({ start: open, end: null, minutes: null });

  const count = (t: string) => sorted.filter((a) => a.type === t).length;
  return {
    summary: {
      meals: count('meal'),
      bottles: count('bottle'),
      bottleOz: sorted.filter((a) => a.type === 'bottle').reduce((s, a) => s + (Number(a.details?.ounces) || 0), 0),
      diapers: count('diaper') + count('potty'),
      napMinutes: naps.reduce((s, n) => s + (n.minutes ?? 0), 0),
      photos: count('photo'),
    },
    naps,
    timeline: sorted.map((a) => ({
      id: a.id, time: formatTime(a.occurred_at, tz), type: a.type, label: describe(a), note: a.note, photo_url: a.photo_url,
    })),
  };
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}
