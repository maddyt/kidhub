import Link from 'next/link';
import { requireAdmin } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { money } from '@/lib/domain/billing.ts';
import { addDays, dayIn } from '@/lib/domain/time.ts';
import { PageHeader, Stat, Badge, Field, Empty } from '@/components/ui.tsx';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { createInvoice, setInvoiceStatus, createPlan, togglePlan, deletePlan, runBillingNow } from './actions.ts';

export const metadata = { title: 'Billing' };
const TABS = ['open', 'overdue', 'paid', 'void'] as const;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ tab?: string; child?: string }> }) {
  const ctx = await requireAdmin();
  const sp = await searchParams;
  const tab = TABS.includes(sp.tab as any) ? sp.tab! : 'open';
  const supabase = await supabaseServer();
  const today = dayIn(ctx.school.timezone);
  const [{ data: invoices }, { data: plans }, { data: kids }, { data: payers }] = await Promise.all([
    supabase.from('invoices').select('id, child_id, payer_id, description, amount_cents, issued_on, due_on, status, paid_at, paid_method')
      .eq('school_id', ctx.school.id).gte('issued_on', addDays(today, -400)).order('due_on', { ascending: false }),
    supabase.from('billing_plans').select('*').eq('school_id', ctx.school.id).order('created_at'),
    supabase.from('children').select('id, first_name, last_name').eq('school_id', ctx.school.id).neq('status', 'withdrawn').order('first_name'),
    supabase.from('guardians').select('child_id, profile_id, profile:profiles(full_name)').eq('access', 'full'),
  ]);
  const all = invoices ?? [];
  const childName = new Map((kids ?? []).map((k) => [k.id, `${k.first_name} ${k.last_name}`]));
  const payerName = new Map((payers ?? []).map((p: any) => [p.profile_id, (Array.isArray(p.profile) ? p.profile[0] : p.profile)?.full_name]));
  const isOverdue = (i: (typeof all)[number]) => i.status === 'open' && i.due_on < today;
  const shown = all.filter((i) => (tab === 'overdue' ? isOverdue(i) : i.status === tab) && (!sp.child || i.child_id === sp.child));

  const sum = (xs: typeof all) => xs.reduce((s, i) => s + i.amount_cents, 0);
  const monthStart = today.slice(0, 8) + '01';
  const paid90 = all.filter((i) => i.status === 'paid' && i.paid_at && i.due_on >= addDays(today, -90));
  const onTime = paid90.filter((i) => String(i.paid_at).slice(0, 10) <= i.due_on).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Billing" subtitle={ctx.school.name} actions={
        <ActionForm action={runBillingNow}><SubmitButton className="btn-secondary" pendingText="Running…">Run billing now</SubmitButton></ActionForm>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Outstanding" value={money(sum(all.filter((i) => i.status === 'open')))} />
        <Stat label="Overdue" value={money(sum(all.filter(isOverdue)))} tone={all.some(isOverdue) ? 'amber' : undefined} hint={`${all.filter(isOverdue).length} invoices`} />
        <Stat label="Collected this month" value={money(sum(all.filter((i) => i.status === 'paid' && String(i.paid_at).slice(0, 10) >= monthStart)))} />
        <Stat label="On-time payment rate" value={paid90.length ? `${Math.round((onTime / paid90.length) * 100)}%` : '—'} hint="last 90 days" />
      </div>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {TABS.map((t) => <Link key={t} href={`/billing?tab=${t}${sp.child ? `&child=${sp.child}` : ''}`} className={`chip capitalize ${tab === t ? 'bg-brand text-white' : 'border border-rule bg-white'}`}>{t}</Link>)}
          {sp.child && <Link href={`/billing?tab=${tab}`} className="chip border border-rule bg-white">{childName.get(sp.child)} ✕</Link>}
        </div>
        {shown.length === 0 ? <Empty>No {tab} invoices.</Empty> : (
          <div className="overflow-x-auto"><table className="table">
            <thead><tr><th>Child</th><th>Description</th><th>Payer</th><th>Due</th><th className="text-right">Amount</th><th /></tr></thead>
            <tbody>{shown.map((i) => (
              <tr key={i.id}>
                <td><Link href={`/billing?tab=${tab}&child=${i.child_id}`} className="hover:underline">{childName.get(i.child_id) ?? '—'}</Link></td>
                <td>{i.description}</td>
                <td className="text-muted">{i.payer_id ? payerName.get(i.payer_id) ?? '—' : 'Family'}</td>
                <td>{i.due_on} {isOverdue(i) && <Badge tone="amber">overdue</Badge>}</td>
                <td className="text-right font-medium">{money(i.amount_cents)}</td>
                <td className="text-right">
                  {i.status === 'open' && (
                    <form action={setInvoiceStatus} className="inline-flex gap-1">
                      <input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="paid" />
                      <select name="method" className="input w-24 py-1 text-xs" aria-label="Method"><option>card</option><option>ACH</option><option>check</option><option>cash</option><option>subsidy</option></select>
                      <button className="btn-primary btn-sm">Mark paid</button>
                    </form>)}
                  {i.status === 'paid' && <span className="text-xs text-muted">paid {String(i.paid_at).slice(0, 10)} · {i.paid_method}</span>}
                  {i.status !== 'void' && (
                    <form action={setInvoiceStatus} className="ml-1 inline"><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value={i.status === 'paid' ? 'open' : 'void'} />
                      <button className="text-xs text-muted hover:text-danger">{i.status === 'paid' ? 'undo' : 'void'}</button></form>)}
                  {i.status === 'void' && (
                    <form action={setInvoiceStatus} className="inline"><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="open" />
                      <button className="text-xs text-muted hover:underline">reopen</button></form>)}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="h2 mb-2">Recurring tuition plans</h2>
          {(plans ?? []).length === 0 ? <p className="muted">No plans yet.</p> : (
            <ul className="divide-y divide-rule">{(plans ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><span className="font-medium">{childName.get(p.child_id) ?? '—'}</span> · {p.description} · {money(p.amount_cents)} {p.frequency}
                  {(p.split ?? []).length > 1 && <> · <Badge tone="brand">split {(p.split ?? []).length} ways</Badge></>}
                  <span className="muted"> · next {p.next_bill_date}</span></span>
                <span className="flex gap-2">
                  <form action={togglePlan}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={String(!p.active)} />
                    <button className="btn-secondary btn-sm">{p.active ? 'Pause' : 'Resume'}</button></form>
                  <form action={deletePlan}><input type="hidden" name="id" value={p.id} /><button className="text-xs text-muted hover:text-danger">delete</button></form>
                </span>
              </li>
            ))}</ul>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-brand">+ New plan</summary>
            <ActionForm action={createPlan} className="mt-3 grid gap-2 sm:grid-cols-2">
              <Field label="Child"><select name="child_id" required className="input" defaultValue={sp.child}>{(kids ?? []).map((k) => <option key={k.id} value={k.id}>{k.first_name} {k.last_name}</option>)}</select></Field>
              <Field label="Description"><input name="description" defaultValue="Tuition" required className="input" /></Field>
              <Field label="Amount ($)"><input name="amount" inputMode="decimal" required placeholder="1250.00" className="input" /></Field>
              <Field label="Frequency"><select name="frequency" className="input"><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select></Field>
              <Field label="First bill date"><input name="next_bill_date" type="date" defaultValue={today} className="input" /></Field>
              <Field label="Due after (days)"><input name="due_days" type="number" min={0} defaultValue={7} className="input" /></Field>
              <Field label="Payers" className="sm:col-span-2"><select name="split" className="input"><option value="single">One invoice to the family</option><option value="even">Split evenly between parents (separate invoices)</option></select></Field>
              <div><SubmitButton>Save plan</SubmitButton></div>
            </ActionForm>
          </details>
        </section>

        <section className="card">
          <h2 className="h2 mb-2">One-off invoice</h2>
          <ActionForm action={createInvoice} resetOnSuccess className="grid gap-2 sm:grid-cols-2">
            <Field label="Child"><select name="child_id" required className="input" defaultValue={sp.child}>{(kids ?? []).map((k) => <option key={k.id} value={k.id}>{k.first_name} {k.last_name}</option>)}</select></Field>
            <Field label="Description"><input name="description" placeholder="e.g. Field trip" required className="input" /></Field>
            <Field label="Amount ($)"><input name="amount" inputMode="decimal" required className="input" /></Field>
            <Field label="Due"><input name="due_on" type="date" defaultValue={addDays(today, 7)} className="input" /></Field>
            <div><SubmitButton>Create invoice</SubmitButton></div>
          </ActionForm>
          <h2 className="h2 mb-1 mt-5">Year-end statements</h2>
          <p className="muted mb-2">Printable summaries of payments for tax/FSA purposes. Families can open their own.</p>
          <div className="flex flex-wrap gap-1.5">{(kids ?? []).map((k) => (
            <Link key={k.id} href={`/statement/${k.id}?year=${Number(today.slice(0, 4)) - (today.slice(5) < '03' ? 1 : 0)}`} className="chip border border-rule bg-white hover:bg-canvas">{k.first_name} {k.last_name}</Link>
          ))}</div>
        </section>
      </div>
      <p className="muted text-xs">Online card/ACH payments are not connected yet. Record payments here as they arrive. See README → Roadmap for adding Stripe.</p>
    </div>
  );
}
