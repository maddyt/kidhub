import { requireAdmin } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { describeWindow } from '@/lib/domain/video.ts';
import { PageHeader, Badge, Field, Empty, Notice } from '@/components/ui.tsx';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { VideoPlayer } from '@/components/VideoPlayer.tsx';
import { addCamera, updateCamera, addWindow, deleteWindow } from './actions.ts';

export const metadata = { title: 'Cameras' };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default async function VideoAdmin({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const ctx = await requireAdmin();
  const { preview } = await searchParams;
  const supabase = await supabaseServer();
  const [{ data: cams }, { data: rooms }] = await Promise.all([
    supabase.from('cameras').select('*, windows:video_windows(*)').eq('school_id', ctx.school.id).order('name'),
    supabase.from('classrooms').select('id, name').eq('school_id', ctx.school.id).order('name'),
  ]);
  const roomName = new Map((rooms ?? []).map((r) => [r.id, r.name]));
  const previewing = (cams ?? []).find((c) => c.id === preview);

  return (
    <div className="space-y-5">
      <PageHeader title="Cameras & live video" subtitle="Families see a classroom camera only for their own child’s room, only during the windows you set, and only after you approve them." />
      <Notice>Streams must be HLS (<code>.m3u8</code>) over https. Most IP cameras output RTSP; a restreaming service (see README → Live video) converts it. The stream URL is never shown to families.</Notice>
      {previewing && <VideoPlayer src={previewing.stream_url} title={`Preview: ${previewing.name}`} />}
      {(cams ?? []).length === 0 && <Empty>No cameras yet.</Empty>}
      {(cams ?? []).map((c: any) => (
        <section key={c.id} className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="h2">{c.name} {!c.active && <Badge>off</Badge>}</h2>
              <div className="muted text-xs">{c.classroom_id ? `Classroom: ${roomName.get(c.classroom_id)}` : 'Common area (all families at this school)'}</div>
            </div>
            <div className="flex gap-2">
              <a href={`/video?preview=${c.id}`} className="btn-secondary btn-sm">Preview</a>
              <form action={updateCamera}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={String(!c.active)} /><button className="btn-secondary btn-sm">{c.active ? 'Turn off' : 'Turn on'}</button></form>
              <form action={updateCamera}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="delete" value="1" /><button className="btn-danger btn-sm">Delete</button></form>
            </div>
          </div>
          <div>
            <div className="label">Family viewing windows</div>
            {(c.windows ?? []).length === 0 ? <p className="text-sm text-danger">No windows: families cannot watch this camera.</p> : (
              <ul className="flex flex-wrap gap-2">{c.windows.map((w: any) => (
                <li key={w.id} className="chip border border-rule bg-white">{describeWindow(w)}
                  <form action={deleteWindow} className="inline"><input type="hidden" name="id" value={w.id} /><button className="ml-1 text-muted hover:text-danger" aria-label="Remove window">✕</button></form></li>
              ))}</ul>
            )}
            <ActionForm action={addWindow} className="mt-2 flex flex-wrap items-end gap-2">
              <input type="hidden" name="camera_id" value={c.id} />
              <div className="flex gap-1">{DAYS.map((d, i) => (
                <label key={d} className="chip cursor-pointer border border-rule bg-white"><input type="checkbox" name="days" value={i} defaultChecked={i >= 1 && i <= 5} /> {d}</label>
              ))}</div>
              <input type="time" name="start_time" defaultValue="09:00" className="input w-28 py-1" aria-label="Start" />
              <input type="time" name="end_time" defaultValue="11:30" className="input w-28 py-1" aria-label="End" />
              <SubmitButton className="btn-secondary btn-sm">Add window</SubmitButton>
            </ActionForm>
          </div>
        </section>
      ))}
      <section className="card">
        <h2 className="h2 mb-2">Add a camera</h2>
        <ActionForm action={addCamera} resetOnSuccess className="grid gap-2 sm:grid-cols-3">
          <Field label="Name"><input name="name" required placeholder="e.g. Infant room" className="input" /></Field>
          <Field label="Location"><select name="classroom_id" className="input"><option value="">Common area / playground</option>{(rooms ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></Field>
          <Field label="HLS stream URL"><input name="stream_url" required placeholder="https://…/stream.m3u8" className="input" /></Field>
          <div><SubmitButton>Add camera</SubmitButton></div>
        </ActionForm>
      </section>
    </div>
  );
}
