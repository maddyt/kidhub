'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { runBilling } from '@/lib/data/billing.ts';
import { parseMoney } from '@/lib/domain/billing.ts';
import { addDays, dayIn } from '@/lib/domain/time.ts';
import type { ActionResult } from '@/components/ActionForm.tsx';

const done = () => { revalidatePath('/billing'); revalidatePath('/dashboard'); };

export async function createInvoice(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await supabaseServer();
  const cents = parseMoney(String(form.get('amount')));
  const description = String(form.get('description') ?? '').trim();
  if (!cents || !description) return { error: 'Add a description and an amount.' };
  const { error } = await supabase.from('invoices').insert({
    school_id: ctx.school.id, child_id: String(form.get('child_id')), description, amount_cents: cents,
    due_on: String(form.get('due_on') || addDays(dayIn(ctx.school.timezone), 7)), payer_id: String(form.get('payer_id') || '') || null,
  });
  if (error) return { error: error.message };
  done();
  return { ok: true, message: 'Invoice created.' };
}

export async function setInvoiceStatus(form: FormData) {
  await requireAdmin();
  const supabase = await supabaseServer();
  const status = String(form.get('status'));
  const patch = status === 'paid'
    ? { status, paid_at: new Date().toISOString(), paid_method: String(form.get('method') || 'other') }
    : { status, paid_at: null, paid_method: null };
  await supabase.from('invoices').update(patch).eq('id', String(form.get('id')));
  done();
}

export async function createPlan(_: ActionResult, form: FormData): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await supabaseServer();
  const child_id = String(form.get('child_id'));
  const cents = parseMoney(String(form.get('amount')));
  const description = String(form.get('description') ?? '').trim();
  if (!cents || !description || !child_id) return { error: 'Choose a child and add a description and amount.' };

  let split: { profile_id: string; percent: number }[] = [];
  if (form.get('split') === 'even') {
    const { data: gs } = await supabase.from('guardians').select('profile_id').eq('child_id', child_id).eq('access', 'full');
    split = (gs ?? []).map((g) => ({ profile_id: g.profile_id, percent: 1 }));
    if (split.length < 2) return { error: 'Splitting needs at least two parents linked to this child.' };
  }
  const { error } = await supabase.from('billing_plans').insert({
    school_id: ctx.school.id, child_id, description, amount_cents: cents,
    frequency: form.get('frequency') === 'weekly' ? 'weekly' : 'monthly',
    next_bill_date: String(form.get('next_bill_date') || dayIn(ctx.school.timezone)),
    due_days: Number(form.get('due_days') || 7), split,
  });
  if (error) return { error: error.message };
  done();
  return { ok: true, message: 'Plan saved. Invoices are issued automatically each morning (or press “Run billing now”).' };
}

export async function togglePlan(form: FormData) {
  await requireAdmin();
  const supabase = await supabaseServer();
  await supabase.from('billing_plans').update({ active: form.get('active') === 'true' }).eq('id', String(form.get('id')));
  done();
}

export async function deletePlan(form: FormData) {
  await requireAdmin();
  const supabase = await supabaseServer();
  await supabase.from('billing_plans').delete().eq('id', String(form.get('id')));
  done();
}

export async function runBillingNow(_: ActionResult): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const supabase = await supabaseServer();
  try {
    const r = await runBilling(supabase, [ctx.school.id]);
    done();
    return { ok: true, message: r.issued ? `Issued ${r.issued} invoice${r.issued > 1 ? 's' : ''}.` : 'Nothing due today.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Billing failed.' };
  }
}
