import Link from 'next/link';
import { requireAdmin } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { PageHeader, Badge, Empty, Notice } from '@/components/ui.tsx';

export const metadata = { title: 'Audit log' };

const ENTITIES: Record<string, string> = {
  attendance: 'Attendance', pickups: 'Pickup list', guardians: 'Family access', children: 'Children', invoices: 'Invoices',
  billing_plans: 'Billing plans', school_staff: 'Staff roles', cameras: 'Cameras', video_windows: 'Video windows',
  invitations: 'Invitations', camera: 'Video viewing', schools: 'School settings', classrooms: 'Classrooms', security: 'Security',
};
const NOISE = new Set(['id', 'created_at', 'school_id', 'child_id', 'token']);
const LABEL_KEYS = ['first_name', 'last_name', 'name', 'description', 'email', 'relationship', 'picked_up_by', 'dropped_off_by', 'role', 'status'];

function summarize(e: { action: string; old_data: any; new_data: any; detail: string | null }): string {
  if (e.detail) return e.detail;
  const row = e.new_data ?? e.old_data ?? {};
  const label = LABEL_KEYS.map((k) => row[k]).filter((v) => v !== null && v !== undefined && v !== '').slice(0, 3).join(' · ');
  if (e.action !== 'update' || !e.old_data || !e.new_data) return label;
  const changed = Object.keys(e.new_data).filter((k) => !NOISE.has(k) && JSON.stringify(e.new_data[k]) !== JSON.stringify(e.old_data[k]));
  return `${label ? `${label}: ` : ''}${changed.map((k) => `${k.replace(/_/g, ' ')} ${fmt(e.old_data[k])} → ${fmt(e.new_data[k])}`).join('; ')}`;
}
const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v).slice(0, 40));

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  const ctx = await requireAdmin();
  const { entity } = await searchParams;
  const supabase = await supabaseServer();
  let q = supabase.from('audit_events').select('id, at, actor, entity, action, entity_id, old_data, new_data, detail')
    .eq('school_id', ctx.school.id).order('at', { ascending: false }).limit(300);
  if (entity) q = q.eq('entity', entity);
  const { data, error } = await q;
  const actors = [...new Set((data ?? []).map((e) => e.actor).filter(Boolean))] as string[];
  const { data: people } = actors.length ? await supabase.from('profiles').select('id, full_name, email').in('id', actors) : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));
  const tz = ctx.school.timezone;
  const when = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" subtitle={`Who changed what at ${ctx.school.name}. Entries can’t be edited or deleted.`} />
      {error ? <Notice tone="amber">The audit log isn’t set up yet. Run <code>supabase/migrations/0002_security.sql</code> in the Supabase SQL editor.</Notice> : (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Link href="/audit" className={`chip ${!entity ? 'bg-brand text-white' : 'border border-rule bg-white'}`}>All</Link>
            {Object.entries(ENTITIES).map(([k, v]) => <Link key={k} href={`/audit?entity=${k}`} className={`chip ${entity === k ? 'bg-brand text-white' : 'border border-rule bg-white'}`}>{v}</Link>)}
          </div>
          <section className="card overflow-x-auto">
            {(data ?? []).length === 0 ? <Empty>No entries yet.</Empty> : (
              <table className="table">
                <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
                <tbody>{(data ?? []).map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-muted">{when(e.at)}</td>
                    <td className="whitespace-nowrap">{e.actor ? who.get(e.actor) ?? 'Unknown user' : <span className="text-muted">System</span>}</td>
                    <td className="whitespace-nowrap">{ENTITIES[e.entity] ?? e.entity} <Badge tone={e.action === 'delete' ? 'red' : e.action === 'insert' ? 'green' : 'gray'}>{e.action}</Badge></td>
                    <td className="max-w-md text-xs">{summarize(e)}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
