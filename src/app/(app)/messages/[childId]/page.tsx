import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { PageHeader } from '@/components/ui.tsx';
import { Thread, type Msg } from './Thread.tsx';

export const metadata = { title: 'Messages' };

export default async function ThreadPage({ params }: { params: Promise<{ childId: string }> }) {
  const { childId } = await params;
  const ctx = await requireUser();
  const supabase = await supabaseServer();
  const { data: child } = await supabase.from('children').select('id, first_name, last_name, school_id, school:schools(name, timezone)').eq('id', childId).maybeSingle();
  if (!child) notFound();
  const isStaffHere = ctx.schools.some((s) => s.id === child.school_id);
  const isFullGuardian = ctx.guardianOf.some((g) => g.child_id === childId && g.access === 'full');
  if (!isStaffHere && !isFullGuardian) notFound();

  const { data: msgs } = await supabase.from('messages').select('id, sender_id, body, created_at').eq('child_id', childId)
    .order('created_at', { ascending: false }).limit(200);
  const senderIds = [...new Set((msgs ?? []).map((m) => m.sender_id))];
  const { data: people } = senderIds.length ? await supabase.from('profiles').select('id, full_name').in('id', senderIds) : { data: [] };
  const names = Object.fromEntries((people ?? []).map((p) => [p.id, p.full_name || 'Someone']));
  const school = Array.isArray(child.school) ? child.school[0] : (child.school as any);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <Link href={isStaffHere ? '/messages' : '/family/messages'} className="muted hover:underline">← All conversations</Link>
      <PageHeader title={`${child.first_name} ${child.last_name}`} subtitle={`Conversation between ${child.first_name}’s family and ${school?.name ?? 'the school'} staff`} />
      <Thread childId={childId} schoolId={child.school_id} me={ctx.userId} initial={((msgs ?? []) as Msg[]).reverse()} names={names} tz={school?.timezone ?? 'UTC'} />
    </div>
  );
}
