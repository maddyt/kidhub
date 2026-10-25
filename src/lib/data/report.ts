import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dailyReport } from '../domain/report.ts';
import { dayBounds } from '../domain/time.ts';
import { signPhotos } from './media.ts';

/** A child's daily report for `day`, with photo URLs signed for the viewer. RLS decides what is visible. */
export async function loadDailyReport(supabase: SupabaseClient, childId: string, day: string, tz: string) {
  const { start, end } = dayBounds(day, tz);
  const { data } = await supabase.from('activities').select('id, type, occurred_at, note, details, photo_path, approved')
    .eq('child_id', childId).gte('occurred_at', start.toISOString()).lt('occurred_at', end.toISOString());
  const rows = data ?? [];
  const urls = await signPhotos(supabase, rows.map((r) => r.photo_path));
  return dailyReport(rows.map((r) => ({ ...r, photo_url: r.photo_path ? urls.get(r.photo_path) ?? null : null })), tz);
}
