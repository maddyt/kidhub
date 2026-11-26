import { requireFamily } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { loadFamilyChildren } from '@/lib/data/family.ts';
import { listPacketRequestsForChild } from '@/lib/data/packets.ts';
import { PLANE_INFO, type Plane } from '@/lib/domain/packets.ts';
import { imageGenerationConfigured } from '@/lib/images/provider.ts';
import { PageHeader, Badge, Empty, Notice } from '@/components/ui.tsx';
import { RequestForm } from '../../packets/RequestForm.tsx';
import { requestFamilyPacket, deleteFamilyPacketRequest } from './actions.ts';

export const metadata = { title: 'Packet Generator' };
// Applies to requestFamilyPacket (./actions.ts) too: illustration generation (parallelized, but
// still real network calls) can exceed Vercel's 10s default.
export const maxDuration = 60;

const STATUS_TONE = { draft: 'gray', manifest_ready: 'amber', compiled: 'green', failed: 'red' } as const;

export default async function FamilyPacketsPage() {
  const ctx = await requireFamily();
  const supabase = await supabaseServer();
  const kids = (await loadFamilyChildren(supabase, ctx)).filter((k) => k.access === 'full');
  const lists = await Promise.all(kids.map((k) => listPacketRequestsForChild(supabase, k.id)));
  const nameOf = new Map(kids.map((k) => [k.id, k.first_name]));
  const requests = lists.flat().sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="space-y-6">
      <PageHeader title="Packet Generator" subtitle="Turn your child's question into a printable Montessori packet to work on at home" />
      {!imageGenerationConfigured() && (
        <Notice tone="amber">Illustrated picture cards aren't available yet — packets include label strips or definition cards, a short story and a hands-on activity.</Notice>
      )}
      {kids.length === 0 ? <Empty>Ask your child's school to add you as a guardian first.</Empty> : (
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="card lg:col-span-2">
            <h2 className="h2 mb-2">New packet</h2>
            <RequestForm action={requestFamilyPacket} childRequired children={kids.map((k) => ({ id: k.id, name: k.first_name }))} />
          </section>
          <section className="card lg:col-span-3">
            <h2 className="h2 mb-2">Past packets</h2>
            {requests.length === 0 ? <Empty>Packets you generate will appear here.</Empty> : (
              <ul className="divide-y divide-rule">
                {requests.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <a href={`/packets/${r.id}`} className="font-medium hover:underline">{r.topic}</a>
                      <div className="muted text-xs">
                        {nameOf.get(r.child_id ?? '')} · {PLANE_INFO[r.developmental_plane as Plane]?.label ?? r.developmental_plane} · {String(r.created_at).slice(0, 10)}
                      </div>
                    </div>
                    <Badge tone={STATUS_TONE[r.status]}>{r.status.replace('_', ' ')}</Badge>
                    <form action={deleteFamilyPacketRequest}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-muted hover:text-danger">delete</button></form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
