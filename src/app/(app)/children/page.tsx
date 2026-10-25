import Link from 'next/link';
import { requireStaff } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { ageLabel, dayIn } from '@/lib/domain/time.ts';
import { PageHeader, Badge, Avatar, Empty } from '@/components/ui.tsx';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { ChildFields } from '@/components/ChildFields.tsx';
import { createChild } from './actions.ts';

export const metadata = { title: 'Children' };
const TABS = ['enrolled', 'waitlist', 'withdrawn'] as const;

export default async function ChildrenPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const status = TABS.includes(sp.status as any) ? sp.status! : 'enrolled';
  const supabase = await supabaseServer();
  const [{ data: kids }, { data: rooms }, { data: counts }] = await Promise.all([
    supabase.from('children').select('id, first_name, last_name, birth_date, allergies, classroom_id, created_at')
      .eq('school_id', ctx.school.id).eq('status', status).order('first_name'),
    supabase.from('classrooms').select('id, name, capacity').eq('school_id', ctx.school.id).order('name'),
    supabase.from('children').select('status').eq('school_id', ctx.school.id),
  ]);
  const today = dayIn(ctx.school.timezone);
  const roomName = new Map((rooms ?? []).map((r) => [r.id, r.name]));
  const q = (sp.q ?? '').toLowerCase();
  const list = (kids ?? []).filter((k) => !q || `${k.first_name} ${k.last_name}`.toLowerCase().includes(q));
  const n = (st: string) => (counts ?? []).filter((c) => c.status === st).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Children" subtitle={`${n('enrolled')} enrolled · ${n('waitlist')} on waitlist`} />
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => <Link key={t} href={`/children?status=${t}`} className={`chip capitalize ${status === t ? 'bg-brand text-white' : 'border border-rule bg-white'}`}>{t} ({n(t)})</Link>)}
        <form className="ml-auto"><input type="hidden" name="status" value={status} /><input name="q" defaultValue={sp.q} placeholder="Search…" className="input w-48 py-1.5" /></form>
      </div>
      <section className="card">
        {list.length === 0 ? <Empty>No children here.</Empty> : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{list.map((k) => (
            <li key={k.id}>
              <Link href={`/children/${k.id}`} className="flex items-center gap-3 rounded-lg border border-rule p-3 hover:bg-canvas">
                <Avatar name={`${k.first_name} ${k.last_name}`} />
                <div className="min-w-0">
                  <div className="font-medium">{k.first_name} {k.last_name}</div>
                  <div className="text-xs text-muted">{[ageLabel(k.birth_date, today), k.classroom_id && roomName.get(k.classroom_id),
                    status === 'waitlist' && `added ${String(k.created_at).slice(0, 10)}`].filter(Boolean).join(' · ')}</div>
                  {k.allergies && <Badge tone="red">⚠ {k.allergies}</Badge>}
                </div>
              </Link>
            </li>
          ))}</ul>
        )}
      </section>
      {ctx.isAdmin && (
        <details className="card">
          <summary className="cursor-pointer font-medium">+ Add a child (enroll or waitlist)</summary>
          <ActionForm action={createChild} className="mt-4 space-y-3">
            <ChildFields rooms={rooms ?? []} v={{ status }} />
            <SubmitButton>Add child</SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
