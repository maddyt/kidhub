import Link from 'next/link';
import { requireAdmin } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { signPhotos } from '@/lib/data/media.ts';
import { formatTime } from '@/lib/domain/time.ts';
import { PageHeader, Empty, Badge } from '@/components/ui.tsx';
import { reviewPhoto } from './actions.ts';
import { setVideoApproval } from '../children/actions.ts';

export const metadata = { title: 'Approvals' };

export default async function ApprovalsPage() {
  const ctx = await requireAdmin();
  const supabase = await supabaseServer();
  const [{ data: photos }, { data: pending }] = await Promise.all([
    supabase.from('activities').select('id, child_id, note, photo_path, occurred_at, child:children(first_name, last_name)')
      .eq('school_id', ctx.school.id).eq('approved', false).order('occurred_at', { ascending: false }),
    supabase.from('guardians').select('child_id, profile_id, relationship, access, profile:profiles(full_name, email), child:children!inner(first_name, last_name, school_id)')
      .eq('child.school_id', ctx.school.id).eq('video_approved', false),
  ]);
  const urls = await signPhotos(supabase, (photos ?? []).map((p) => p.photo_path));
  const one = (x: any) => (Array.isArray(x) ? x[0] : x);

  return (
    <div className="space-y-6">
      <PageHeader title="Approvals" subtitle="Nothing reaches families until a director says so" />
      <section className="card">
        <h2 className="h2 mb-1">Photos awaiting approval</h2>
        <p className="muted mb-3">Turn approval on or off in <Link href="/settings" className="underline">Settings</Link> (currently {ctx.school.require_photo_approval ? 'on' : 'off'}).</p>
        {(photos ?? []).length === 0 ? <Empty>No photos waiting.</Empty> : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(photos ?? []).map((p: any) => (
            <li key={p.id} className="rounded-lg border border-rule p-2">
              {p.photo_path && urls.get(p.photo_path) && <img src={urls.get(p.photo_path)} alt="" className="aspect-video w-full rounded object-cover" />}
              <div className="mt-1 text-sm font-medium">{one(p.child)?.first_name} {one(p.child)?.last_name} · {formatTime(p.occurred_at, ctx.school.timezone)}</div>
              {p.note && <div className="muted text-xs">{p.note}</div>}
              <div className="mt-2 flex gap-2">
                <form action={reviewPhoto}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="decision" value="approve" /><button className="btn-primary btn-sm">Approve</button></form>
                <form action={reviewPhoto}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="decision" value="reject" /><button className="btn-danger btn-sm">Delete</button></form>
              </div>
            </li>
          ))}</ul>
        )}
      </section>
      <section className="card">
        <h2 className="h2 mb-1">Family video access</h2>
        <p className="muted mb-3">Every family member must be approved before they can watch live video.</p>
        {(pending ?? []).length === 0 ? <Empty>No one waiting.</Empty> : (
          <ul className="divide-y divide-rule">{(pending ?? []).map((g: any) => (
            <li key={`${g.child_id}:${g.profile_id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span><span className="font-medium">{one(g.profile)?.full_name || one(g.profile)?.email}</span> <span className="muted">· {g.relationship} of {one(g.child)?.first_name} {one(g.child)?.last_name}</span> {g.access === 'video_only' && <Badge>video only</Badge>}</span>
              <form action={setVideoApproval}>
                <input type="hidden" name="child_id" value={g.child_id} /><input type="hidden" name="profile_id" value={g.profile_id} /><input type="hidden" name="approved" value="true" />
                <button className="btn-primary btn-sm">Approve video</button>
              </form>
            </li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
