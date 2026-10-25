import { NextResponse, type NextRequest } from 'next/server';
import { getContext } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { addDays, dayBounds, formatTime } from '@/lib/domain/time.ts';

/** Shifts for a week as CSV, ready to import into a payroll provider. Admins only. */
export async function GET(req: NextRequest) {
  const ctx = await getContext();
  if (!ctx?.school || !ctx.isAdmin) return new NextResponse('Forbidden', { status: 403 });
  const from = req.nextUrl.searchParams.get('from') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return new NextResponse('from=YYYY-MM-DD required', { status: 400 });
  const tz = ctx.school.timezone;
  const supabase = await supabaseServer();
  const { data } = await supabase.from('shifts').select('clock_in_at, clock_out_at, profile:profiles(full_name, email)')
    .eq('school_id', ctx.school.id).gte('clock_in_at', dayBounds(from, tz).start.toISOString())
    .lt('clock_in_at', dayBounds(addDays(from, 7), tz).start.toISOString()).order('clock_in_at');
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = ['name,email,date,clock_in,clock_out,hours'];
  for (const s of (data ?? []) as any[]) {
    const p = Array.isArray(s.profile) ? s.profile[0] : s.profile;
    const hours = s.clock_out_at ? ((new Date(s.clock_out_at).getTime() - new Date(s.clock_in_at).getTime()) / 3.6e6).toFixed(2) : '';
    lines.push([esc(p?.full_name ?? ''), esc(p?.email ?? ''), new Date(s.clock_in_at).toLocaleDateString('en-CA', { timeZone: tz }),
      formatTime(s.clock_in_at, tz), s.clock_out_at ? formatTime(s.clock_out_at, tz) : 'open', hours].join(','));
  }
  return new NextResponse(lines.join('\n'), {
    headers: { 'content-type': 'text/csv', 'content-disposition': `attachment; filename="timesheet-${from}.csv"` },
  });
}
