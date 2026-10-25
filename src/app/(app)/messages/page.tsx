import Link from 'next/link';
import { requireStaff } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { formatTime } from '@/lib/domain/time.ts';
import { PageHeader, Avatar, Empty } from '@/components/ui.tsx';

export const metadata = { title: 'Messages' };

export default async function MessagesPage() {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const [{ data: msgs }, { data: kids }] = await Promise.all([
    supabase.from('messages').select('child_id, body, created_at').eq('school_id', ctx.school.id).order('created_at', { ascending: false }).limit(500),
    supabase.from('children').select('id, first_name, last_name').eq('school_id', ctx.school.id).eq('status', 'enrolled').order('first_name'),
  ]);
  const latest = new Map<string, { body: string; created_at: string }>();
  for (const m of msgs ?? []) if (!latest.has(m.child_id)) latest.set(m.child_id, { body: m.body, created_at: m.created_at });
  const threads = (kids ?? []).map((k) => ({ ...k, last: latest.get(k.id) }))
    .sort((a, b) => (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? ''));

  return (
    <div className="space-y-5">
      <PageHeader title="Messages" subtitle="One conversation per child, shared by their family and your staff" />
      {threads.length === 0 ? <Empty>No children enrolled yet.</Empty> : (
        <ul className="card divide-y divide-rule p-0">{threads.map((t) => (
          <li key={t.id}>
            <Link href={`/messages/${t.id}`} className="flex items-center gap-3 p-3 hover:bg-canvas">
              <Avatar name={`${t.first_name} ${t.last_name}`} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2"><span className="font-medium">{t.first_name} {t.last_name}</span>
                  {t.last && <span className="text-xs text-muted">{formatTime(t.last.created_at, ctx.school.timezone)}</span>}</div>
                <div className="truncate text-sm text-muted">{t.last?.body ?? 'No messages yet'}</div>
              </div>
            </Link>
          </li>
        ))}</ul>
      )}
    </div>
  );
}
