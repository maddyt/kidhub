// Human-readable video schedules. Enforcement lives in the database (my_video_feeds()).

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function describeDays(days: number[]): string {
  const set = [...new Set(days)].sort();
  if (set.length === 7) return 'Every day';
  if (set.length === 0) return 'Never';
  if (set.join() === '1,2,3,4,5') return 'Weekdays';
  if (set.join() === '0,6') return 'Weekends';
  return set.map((d) => DAY[d]).join(', ');
}

export function formatClock(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, '0')}${suffix}` : `${hh}${suffix}`;
}

export function describeWindow(w: { days: number[]; start_time: string; end_time: string }): string {
  return `${describeDays(w.days)} ${formatClock(w.start_time)}–${formatClock(w.end_time)}`;
}
