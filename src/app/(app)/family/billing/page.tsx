import Link from 'next/link';
import { requireFamily } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { loadFamilyChildren } from '@/lib/data/family.ts';
import { money } from '@/lib/domain/billing.ts';
import { dayIn } from '@/lib/domain/time.ts';
import { PageHeader, Badge, Stat, Empty } from '@/components/ui.tsx';

export const metadata = { title: 'Billing' };

export default async function FamilyBilling() {
  const ctx = await requireFamily();
  const supabase = await supabaseServer();
  const kids = (await loadFamilyChildren(supabase, ctx)).filter((k) => k.access === 'full');
  const { data: inv } = await supabase.from('invoices').select('id, child_id, payer_id, description, amount_cents, due_on, status, paid_at')
    .in('child_id', kids.map((k) => k.id)).neq('status', 'void').order('due_on', { ascending: false }).limit(100);
  const today = dayIn(kids[0]?.timezone ?? 'UTC');
  const open = (inv ?? []).filter((i) => i.status === 'open');
  const name = new Map(kids.map((k) => [k.id, k.first_name]));
  const year = Number(today.slice(0, 4));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Billing" />
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Balance due" value={money(open.reduce((s, i) => s + i.amount_cents, 0))} />
        <Stat label="Overdue" value={money(open.filter((i) => i.due_on < today).reduce((s, i) => s + i.amount_cents, 0))} tone={open.some((i) => i.due_on < today) ? 'amber' : undefined} />
      </div>
      <section className="card">
        {(inv ?? []).length === 0 ? <Empty>No invoices yet.</Empty> : (
          <table className="table"><thead><tr><th>Child</th><th>Description</th><th>Due</th><th className="text-right">Amount</th><th /></tr></thead>
            <tbody>{(inv ?? []).map((i) => (
              <tr key={i.id}><td>{name.get(i.child_id)}</td><td>{i.description}{i.payer_id && i.payer_id !== ctx.userId && <span className="muted"> (co-parent’s share)</span>}</td><td>{i.due_on}</td>
                <td className="text-right">{money(i.amount_cents)}</td>
                <td className="text-right">{i.status === 'paid' ? <Badge tone="green">paid</Badge> : i.due_on < today ? <Badge tone="amber">overdue</Badge> : <Badge>open</Badge>}</td></tr>
            ))}</tbody></table>
        )}
        <p className="muted mt-3 text-xs">Pay by the methods your school accepts; the office marks invoices paid. Online payment is coming soon.</p>
      </section>
      <section className="card">
        <h2 className="h2 mb-2">Year-end statements</h2>
        <div className="flex flex-wrap gap-2">{kids.flatMap((k) => [year, year - 1].map((y) => (
          <Link key={`${k.id}${y}`} href={`/statement/${k.id}?year=${y}`} className="chip border border-rule bg-white hover:bg-canvas">{k.first_name} · {y}</Link>
        )))}</div>
      </section>
    </div>
  );
}
