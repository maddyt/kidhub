import { requireStaff } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { listPacketRequests } from '@/lib/data/packets.ts';
import { PLANE_INFO, type Plane } from '@/lib/domain/packets.ts';
import { imageGenerationConfigured } from '@/lib/images/provider.ts';
import { PageHeader, Badge, Empty, Notice } from '@/components/ui.tsx';
import { RequestForm } from './RequestForm.tsx';
import { requestPacket, deletePacketRequest } from './actions.ts';

export const metadata = { title: 'Packet Generator' };
// Applies to requestPacket (src/app/(app)/packets/actions.ts) too. 60s wasn't enough: manifest
// generation alone has taken ~75s on a retry even without any image calls, so this needs real
// headroom on top of that, not just past the 10s default.
export const maxDuration = 300;

const STATUS_TONE = { draft: 'gray', manifest_ready: 'amber', compiled: 'green', failed: 'red' } as const;

export default async function PacketsPage() {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const [requests, kids] = await Promise.all([
    listPacketRequests(supabase, ctx.school.id),
    supabase.from('children').select('id, first_name, last_name').eq('school_id', ctx.school.id).eq('status', 'enrolled').order('first_name'),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Packet Generator" subtitle="Turn a curiosity question into a printable Montessori packet" />
      {!imageGenerationConfigured() && (
        <Notice tone="amber">
          No image-generation provider is configured yet, so packets ship as label strips, definition cards, the Cosmic
          Story Hook and a Control of Error activity — no illustrated picture cards. See docs/PACKET-GENERATOR.md.
        </Notice>
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="card lg:col-span-2">
          <h2 className="h2 mb-2">New packet</h2>
          <RequestForm action={requestPacket} children={(kids.data ?? []).map((k) => ({ id: k.id, name: `${k.first_name} ${k.last_name[0]}.` }))} />
        </section>
        <section className="card lg:col-span-3">
          <h2 className="h2 mb-2">Past packets</h2>
          {requests.length === 0 ? <Empty>Generated packets will appear here.</Empty> : (
            <ul className="divide-y divide-rule">
              {requests.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <a href={`/packets/${r.id}`} className="font-medium hover:underline">{r.topic}</a>
                    <div className="muted text-xs">
                      {PLANE_INFO[r.developmental_plane as Plane]?.label ?? r.developmental_plane} · {r.subject_category} · {String(r.created_at).slice(0, 10)}
                    </div>
                    {r.status === 'failed' && r.error && <div className="mt-0.5 text-xs text-danger">{r.error}</div>}
                  </div>
                  <Badge tone={STATUS_TONE[r.status]}>{r.status.replace('_', ' ')}</Badge>
                  <form action={deletePacketRequest}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-muted hover:text-danger">delete</button></form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
