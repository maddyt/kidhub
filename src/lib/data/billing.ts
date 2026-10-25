import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { billingDatesDue, splitAmount, type Frequency, type SplitShare } from '../domain/billing.ts';
import { addDays, dayIn } from '../domain/time.ts';

/**
 * Issue invoices for every active plan whose billing date has arrived, then advance the plan.
 * Idempotent: a unique index stops a plan from billing the same payer twice for one date,
 * so a retried or overlapping run cannot double-charge.
 */
export async function runBilling(supabase: SupabaseClient, schoolIds?: string[]) {
  let q = supabase.from('billing_plans').select('id, school_id, child_id, description, amount_cents, frequency, next_bill_date, due_days, split, school:schools(timezone)').eq('active', true);
  if (schoolIds) q = q.in('school_id', schoolIds);
  const { data: plans, error } = await q;
  if (error) throw error;

  let issued = 0;
  for (const p of plans ?? []) {
    const tz = (Array.isArray(p.school) ? p.school[0] : (p.school as any))?.timezone ?? 'UTC';
    const { dates, next } = billingDatesDue({ id: p.id, next_bill_date: p.next_bill_date, frequency: p.frequency as Frequency }, dayIn(tz));
    if (!dates.length) continue;
    const rows = dates.flatMap((d) => splitAmount(p.amount_cents, (p.split ?? []) as SplitShare[]).map((s) => ({
      school_id: p.school_id, child_id: p.child_id, plan_id: p.id, payer_id: s.profile_id,
      description: `${p.description} (${d})`, amount_cents: s.cents, issued_on: d, due_on: addDays(d, p.due_days),
    })));
    for (const row of rows) {
      const { error: e } = await supabase.from('invoices').insert(row);
      if (!e) issued++;
      else if (e.code !== '23505') throw e; // 23505 = already issued
    }
    const { error: u } = await supabase.from('billing_plans').update({ next_bill_date: next }).eq('id', p.id);
    if (u) throw u;
  }
  return { plans: plans?.length ?? 0, issued };
}
