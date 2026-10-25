import { requireFamily } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { describeWindow } from '@/lib/domain/video.ts';
import { PageHeader, Notice, Empty, Badge } from '@/components/ui.tsx';
import { VideoPlayer } from '@/components/VideoPlayer.tsx';

export const metadata = { title: 'Live video' };
export const dynamic = 'force-dynamic';

export default async function FamilyVideo() {
  await requireFamily();
  const supabase = await supabaseServer();
  // The database decides: approved family member + child's room (or common area) + open viewing window.
  const [{ data: feeds }, { data: schedule }] = await Promise.all([
    supabase.rpc('my_video_feeds'), supabase.rpc('my_video_schedule'),
  ]);
  const unique = [...new Map((feeds ?? []).map((f: any) => [f.camera_id, f])).values()] as any[];
  const approved = (schedule ?? []).some((s: any) => s.approved);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Live video" subtitle="Available during the times your school allows" />
      {!approved && (schedule ?? []).length > 0 && <Notice tone="amber">Your video access is waiting for approval from the school.</Notice>}
      {unique.length === 0 ? <Empty>No cameras are live for you right now.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">{unique.map((f) => (
          <VideoPlayer key={f.camera_id} cameraId={f.camera_id} title={`${f.camera_name}${f.classroom_name ? ` · ${f.classroom_name}` : ''} · until ${String(f.window_ends).slice(0, 5)}`} />
        ))}</div>
      )}
      {(schedule ?? []).length > 0 && (
        <section className="card">
          <h2 className="h2 mb-2">Viewing schedule</h2>
          <ul className="space-y-1 text-sm">{(schedule ?? []).map((s: any, i: number) => (
            <li key={i}>{s.camera_name}{s.classroom_name ? ` (${s.classroom_name})` : ''}: {describeWindow(s)} {!s.approved && <Badge tone="amber">pending approval</Badge>}</li>
          ))}</ul>
        </section>
      )}
      <p className="muted text-xs">For everyone’s privacy, recording or sharing the video is not permitted.</p>
    </div>
  );
}
