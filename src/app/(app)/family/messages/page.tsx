import Link from 'next/link';
import { requireFamily } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { loadFamilyChildren } from '@/lib/data/family.ts';
import { PageHeader, Avatar, Empty } from '@/components/ui.tsx';

export const metadata = { title: 'Messages' };

export default async function FamilyMessages() {
  const ctx = await requireFamily();
  const supabase = await supabaseServer();
  const kids = (await loadFamilyChildren(supabase, ctx)).filter((k) => k.access === 'full');
  const { data: msgs } = await supabase.from('messages').select('child_id, body, created_at').in('child_id', kids.map((k) => k.id)).order('created_at', { ascending: false }).limit(100);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Messages" subtitle="Talk with your child’s teachers and director" />
      {kids.length === 0 ? <Empty>No conversations available.</Empty> : (
        <ul className="card divide-y divide-rule p-0">{kids.map((k) => {
          const last = (msgs ?? []).find((m) => m.child_id === k.id);
          return (
            <li key={k.id}><Link href={`/messages/${k.id}`} className="flex items-center gap-3 p-3 hover:bg-canvas">
              <Avatar name={`${k.first_name} ${k.last_name}`} />
              <div className="min-w-0"><div className="font-medium">{k.first_name} · {k.school_name}</div><div className="truncate text-sm text-muted">{last?.body ?? 'Start a conversation'}</div></div>
            </Link></li>
          );
        })}</ul>
      )}
    </div>
  );
}
