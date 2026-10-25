// Billing math: recurring schedules, split payers and money formatting.
import { addDays } from './time.ts';

export type Frequency = 'weekly' | 'monthly';
export interface SplitShare { profile_id: string; percent: number }

export function nextBillDate(day: string, frequency: Frequency): string {
  if (frequency === 'weekly') return addDays(day, 7);
  const [y, m, d] = day.split('-').map(Number);
  // Clamp to the last day of next month (Jan 31 -> Feb 28/29).
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

/**
 * Split an amount across payers by percentage. Shares always sum exactly to `cents`:
 * leftover cents from rounding go to the payers with the largest remainders.
 */
export function splitAmount(cents: number, split: SplitShare[]): { profile_id: string | null; cents: number }[] {
  const shares = split.filter((s) => s.percent > 0);
  if (shares.length === 0) return [{ profile_id: null, cents }];
  const total = shares.reduce((s, x) => s + x.percent, 0);
  const raw = shares.map((s) => (cents * s.percent) / total);
  const floored = raw.map(Math.floor);
  let left = cents - floored.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - floored[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (left <= 0) break; floored[i]++; left--; }
  return shares.map((s, i) => ({ profile_id: s.profile_id, cents: floored[i] }));
}

export interface DuePlan { id: string; next_bill_date: string; frequency: Frequency }

/** Every billing date on or before `today` (catches up if the cron missed days), and the next date after. */
export function billingDatesDue(plan: DuePlan, today: string, max = 24): { dates: string[]; next: string } {
  const dates: string[] = [];
  let d = plan.next_bill_date;
  while (d <= today && dates.length < max) { dates.push(d); d = nextBillDate(d, plan.frequency); }
  return { dates, next: d };
}

export function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function parseMoney(input: string): number | null {
  const n = Number(String(input).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
