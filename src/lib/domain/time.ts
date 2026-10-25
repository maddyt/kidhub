// Timezone helpers. Every school has its own timezone; "today" always means today at that school.

function parts(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

/** YYYY-MM-DD of `date` in `tz`. */
export function dayIn(tz: string, date: Date = new Date()): string {
  const { y, m, d } = parts(date, tz);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Minutes the zone is ahead of UTC at `date` (e.g. -420 for PDT). */
export function offsetMinutes(tz: string, date: Date): number {
  const { y, m, d, h, min, s } = parts(date, tz);
  return Math.round((Date.UTC(y, m - 1, d, h, min, s) - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** UTC instants bounding the local calendar day `day` (YYYY-MM-DD) in `tz`. */
export function dayBounds(day: string, tz: string): { start: Date; end: Date } {
  const [y, m, d] = day.split('-').map(Number);
  const localMidnight = (yy: number, mm: number, dd: number) => {
    const guess = Date.UTC(yy, mm - 1, dd);
    // Two passes handle days where the offset changes (DST).
    let t = guess - offsetMinutes(tz, new Date(guess)) * 60000;
    t = guess - offsetMinutes(tz, new Date(t)) * 60000;
    return new Date(t);
  };
  return { start: localMidnight(y, m, d), end: localMidnight(y, m, d + 1) };
}

/** "HH:MM" local time in `tz`. */
export function timeIn(tz: string, date: Date = new Date()): string {
  const { h, min } = parts(date, tz);
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function formatTime(iso: string | Date, tz: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export function formatDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function minutesBetween(a: Date | string, b: Date | string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

export function ageLabel(birthDate: string | null, today: string): string {
  if (!birthDate) return '';
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let months = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0);
  if (months < 0) months = 0;
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yr${months >= 36 ? 's' : ''}${months % 12 ? ` ${months % 12} mo` : ''}`;
}
