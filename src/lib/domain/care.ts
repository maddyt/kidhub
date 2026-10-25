// Care timers: diapers and bottles are due on an interval set per classroom.
import { minutesBetween } from './time.ts';

export type CareKind = 'diaper' | 'bottle';
export type CareState = 'ok' | 'due' | 'overdue';

export interface CareActivity { type: string; occurred_at: string }
export interface CareTimer { kind: CareKind; lastAt: string | null; minutesSince: number; interval: number; state: CareState }

/** Due once 80% of the interval has passed, overdue once it is exceeded. */
export function careState(minutesSince: number, interval: number): CareState {
  if (minutesSince > interval) return 'overdue';
  if (minutesSince >= interval * 0.8) return 'due';
  return 'ok';
}

/**
 * Timers for a checked-in child. The clock starts at check-in if nothing has been logged today,
 * so a child who arrives at 9:00 is not instantly "overdue" for a diaper.
 */
export function careTimers(
  activities: CareActivity[],
  checkInAt: string,
  intervals: { diaper_interval_min: number | null; bottle_interval_min: number | null },
  now: Date = new Date(),
): CareTimer[] {
  const timers: CareTimer[] = [];
  const kinds: [CareKind, number | null, string[]][] = [
    ['diaper', intervals.diaper_interval_min, ['diaper', 'potty']],
    ['bottle', intervals.bottle_interval_min, ['bottle']],
  ];
  for (const [kind, interval, types] of kinds) {
    if (!interval) continue;
    const last = activities
      .filter((a) => types.includes(a.type) && a.occurred_at >= checkInAt)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
    const since = minutesBetween(last?.occurred_at ?? checkInAt, now);
    timers.push({ kind, lastAt: last?.occurred_at ?? null, minutesSince: since, interval, state: careState(since, interval) });
  }
  return timers;
}

/** A child is napping if their latest nap event is a start. */
export function isNapping(activities: CareActivity[]): boolean {
  const last = activities
    .filter((a) => a.type === 'nap_start' || a.type === 'nap_end')
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
  return last?.type === 'nap_start';
}
