import Link from 'next/link';
import { requireFamily } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { loadFamilyChildren } from '@/lib/data/family.ts';
import { loadDailyReport } from '@/lib/data/report.ts';
import { dayIn, addDays, formatDate, formatTime, ageLabel } from '@/lib/domain/time.ts';
import { PageHeader, Avatar, Badge } from '@/components/ui.tsx';
import { DailyReportView } from '@/components/DailyReportView.tsx';
import { AnnouncementList } from '@/components/AnnouncementList.tsx';

export const metadata = { title: 'Home' };

export default async function FamilyHome({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const ctx = await requireFamily();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const kids = await loadFamilyChildren(supabase, ctx);
  const schoolIds = [...new Set(kids.map((k) => k.school_id))];
  const tz = kids[0]?.timezone ?? 'UTC';
  const today = dayIn(tz);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? '') && sp.day! <= today ? sp.day! : today;

  const [{ data: ann }, { data: att }, reports] = await Promise.all([
    supabase.from('announcements').select('id, kind, title, body, created_at').in('school_id', schoolIds).gte('created_at', addDays(today, -14)).order('created_at', { ascending: false }).limit(5),
    supabase.from('attendance').select('child_id, check_in_at, check_out_at, picked_up_by, dropped_off_by').in('child_id', kids.map((k) => k.id)).eq('day', day),
    Promise.all(kids.map((k) => (k.access === 'full' ? loadDailyReport(supabase, k.id, day, k.timezone) : null))),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title={`Hi, ${ctx.fullName.split(' ')[0]}`} subtitle={formatDate(day)} actions={
        <div className="flex gap-1">
          <Link href={`/family?day=${addDays(day, -1)}`} className="btn-secondary btn-sm">← Prev day</Link>
          {day < today && <Link href={`/family?day=${addDays(day, 1)}`} className="btn-secondary btn-sm">Next day →</Link>}
          {day !== today && <Link href="/family" className="btn-secondary btn-sm">Today</Link>}
        </div>} />

      {(ann ?? []).length > 0 && <AnnouncementList items={(ann ?? []).slice(0, 2)} />}

      {kids.map((k, i) => {
        const a = (att ?? []).find((x) => x.child_id === k.id);
        return (
          <section key={k.id} className="card space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name={`${k.first_name} ${k.last_name}`} size={44} />
              <div className="flex-1">
                <h2 className="h2">{k.first_name} {k.last_name}</h2>
                <div className="muted text-xs">{[ageLabel(k.birth_date, today), k.classroom, k.school_name].filter(Boolean).join(' · ')}</div>
              </div>
              {k.access === 'video_only' ? null : a ? (a.check_out_at
                ? <Badge>Picked up {formatTime(a.check_out_at, k.timezone)} by {a.picked_up_by}</Badge>
                : <Badge tone="green">Checked in {formatTime(a.check_in_at, k.timezone)}</Badge>)
                : <Badge>Not checked in</Badge>}
            </div>
            {k.access === 'full' && reports[i] ? <DailyReportView report={reports[i]!} />
              : <p className="muted">You have video access for {k.first_name}. <Link href="/family/video" className="text-brand underline">Watch live</Link></p>}
            {k.access === 'full' && (
              <div className="flex flex-wrap gap-2 border-t border-rule pt-3">
                <Link href={`/messages/${k.id}`} className="btn-secondary btn-sm">💬 Message teachers</Link>
                <Link href="/family/video" className="btn-secondary btn-sm">🎥 Live video</Link>
                <Link href="/family/billing" className="btn-secondary btn-sm">💳 Billing</Link>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
