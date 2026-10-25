import { requireFamily } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { loadFamilyChildren } from '@/lib/data/family.ts';
import { signPhotos } from '@/lib/data/media.ts';
import { PageHeader, Badge, Empty } from '@/components/ui.tsx';

export const metadata = { title: 'Milestones' };

/** Portfolio: developmental observations and photos, newest first. */
export default async function Milestones() {
  const ctx = await requireFamily();
  const supabase = await supabaseServer();
  const kids = (await loadFamilyChildren(supabase, ctx)).filter((k) => k.access === 'full');
  const { data } = await supabase.from('activities').select('id, child_id, type, occurred_at, note, details, photo_path')
    .in('child_id', kids.map((k) => k.id)).in('type', ['observation', 'photo']).order('occurred_at', { ascending: false }).limit(120);
  const urls = await signPhotos(supabase, (data ?? []).map((a) => a.photo_path));
  const name = new Map(kids.map((k) => [k.id, k.first_name]));
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Milestones & photos" subtitle="Your child’s portfolio, shared by their teachers" />
      {(data ?? []).length === 0 ? <Empty>Teachers’ observations and photos will appear here.</Empty> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(data ?? []).map((a) => (
          <li key={a.id} className="card p-2">
            {a.photo_path && urls.get(a.photo_path) && <img src={urls.get(a.photo_path)} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />}
            <div className="p-1">
              <div className="flex items-center justify-between text-xs text-muted"><span>{name.get(a.child_id)}</span><span>{String(a.occurred_at).slice(0, 10)}</span></div>
              {a.type === 'observation' && <Badge tone="brand">🌱 {String((a.details as any)?.domain ?? 'milestone')}</Badge>}
              {a.note && <p className="mt-1 text-sm">{a.note}</p>}
            </div>
          </li>
        ))}</ul>
      )}
    </div>
  );
}
