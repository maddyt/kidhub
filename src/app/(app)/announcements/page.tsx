import { requireStaff } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { PageHeader, Field } from '@/components/ui.tsx';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { AnnouncementList } from '@/components/AnnouncementList.tsx';
import { postAnnouncement, deleteAnnouncement } from './actions.ts';

export const metadata = { title: 'Announcements' };

export default async function AnnouncementsPage() {
  const ctx = await requireStaff();
  const supabase = await supabaseServer();
  const { data } = await supabase.from('announcements').select('id, kind, title, body, created_at').eq('school_id', ctx.school.id).order('created_at', { ascending: false }).limit(50);
  const multi = ctx.schools.filter((s) => s.role !== 'teacher').length > 1;
  return (
    <div className="space-y-5">
      <PageHeader title="Announcements" subtitle="Newsletters, closures and emergency notices for every family at this school" />
      {ctx.isAdmin && (
        <section className="card">
          <ActionForm action={postAnnouncement} resetOnSuccess className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Type">
                <select name="kind" className="input"><option value="info">Newsletter / info</option><option value="closure">Closure</option><option value="emergency">Emergency</option></select>
              </Field>
              <Field label="Title" className="sm:col-span-3"><input name="title" required className="input" /></Field>
            </div>
            <Field label="Message"><textarea name="body" rows={4} required className="input" /></Field>
            <div className="flex flex-wrap items-center gap-4">
              <SubmitButton pendingText="Posting…">Post announcement</SubmitButton>
              {multi && <label className="text-sm"><input type="checkbox" name="all" /> Post to all my schools</label>}
              <span className="muted text-xs">Families see it at the top of their home screen.</span>
            </div>
          </ActionForm>
        </section>
      )}
      <AnnouncementList items={data ?? []} onDelete={ctx.isAdmin ? deleteAnnouncement : undefined} />
    </div>
  );
}
