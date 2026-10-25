import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { money } from '@/lib/domain/billing.ts';
import { PrintButton } from '@/components/PrintButton.tsx';

export const metadata = { title: 'Statement' };

/** Year-end payment statement. Visible to the school's admins and the child's full guardians (RLS). */
export default async function Statement({ params, searchParams }: { params: Promise<{ childId: string }>; searchParams: Promise<{ year?: string }> }) {
  const { childId } = await params;
  const year = Number((await searchParams).year) || new Date().getFullYear();
  await requireUser();
  const supabase = await supabaseServer();
  const { data: child } = await supabase.from('children').select('first_name, last_name, school:schools(name, address)').eq('id', childId).maybeSingle();
  if (!child) notFound();
  const { data: paid } = await supabase.from('invoices').select('description, amount_cents, paid_at, paid_method, payer_id')
    .eq('child_id', childId).eq('status', 'paid').gte('paid_at', `${year}-01-01`).lt('paid_at', `${year + 1}-01-01`).order('paid_at');
  const school: any = Array.isArray(child.school) ? child.school[0] : child.school;
  const total = (paid ?? []).reduce((s, i) => s + i.amount_cents, 0);

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-rule bg-white p-8">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <h1 className="h1">Childcare payment statement · {year}</h1>
      <p className="mt-1">{school?.name}{school?.address ? ` · ${school.address}` : ''}</p>
      <p className="muted mb-6">Child: {child.first_name} {child.last_name}</p>
      <table className="table">
        <thead><tr><th>Date paid</th><th>Description</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
        <tbody>{(paid ?? []).map((i, n) => (
          <tr key={n}><td>{String(i.paid_at).slice(0, 10)}</td><td>{i.description}</td><td>{i.paid_method}</td><td className="text-right">{money(i.amount_cents)}</td></tr>
        ))}</tbody>
        <tfoot><tr><td colSpan={3} className="pt-3 font-semibold">Total paid in {year}</td><td className="pt-3 text-right font-semibold">{money(total)}</td></tr></tfoot>
      </table>
      <p className="muted mt-6 text-xs">Provider tax ID and signature can be added by the school for dependent-care FSA or tax credit claims.</p>
    </div>
  );
}
