import type { DailyReport } from '@/lib/domain/report.ts';
import { formatDuration, ACTIVITY_ICONS } from '@/lib/domain/report.ts';
import { Empty } from './ui.tsx';

export function DailyReportView({ report }: { report: DailyReport }) {
  const s = report.summary;
  if (!report.timeline.length) return <Empty>No entries yet for this day.</Empty>;
  const chips = [
    s.meals && `🍎 ${s.meals} meal${s.meals > 1 ? 's' : ''}`,
    s.bottles && `🍼 ${s.bottles} bottle${s.bottles > 1 ? 's' : ''}${s.bottleOz ? ` · ${s.bottleOz} oz` : ''}`,
    s.diapers && `🧷 ${s.diapers} change${s.diapers > 1 ? 's' : ''}`,
    s.napMinutes && `😴 ${formatDuration(s.napMinutes)} nap`,
    s.photos && `📷 ${s.photos} photo${s.photos > 1 ? 's' : ''}`,
  ].filter(Boolean) as string[];
  return (
    <div className="space-y-3">
      {chips.length > 0 && <div className="flex flex-wrap gap-1.5">{chips.map((c) => <span key={c} className="chip bg-canvas text-ink">{c}</span>)}</div>}
      <ol className="relative space-y-3 border-l border-rule pl-4">
        {report.timeline.map((e) => (
          <li key={e.id} className="text-sm">
            <span className="absolute -left-[7px] mt-1 h-3 w-3 rounded-full border-2 border-white bg-brand" aria-hidden />
            <div><span className="text-muted">{e.time}</span> · {ACTIVITY_ICONS[e.type]} <span className="font-medium">{e.label}</span></div>
            {e.note && <div className="text-muted">{e.note}</div>}
            {e.photo_url && <img src={e.photo_url} alt="" className="mt-1.5 max-h-72 rounded-lg border border-rule" />}
          </li>
        ))}
      </ol>
    </div>
  );
}
