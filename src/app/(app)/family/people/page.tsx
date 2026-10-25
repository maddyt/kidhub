import { requireFamily } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { loadFamilyChildren } from '@/lib/data/family.ts';
import { appOrigin } from '@/lib/origin.ts';
import { PageHeader, Badge, Field } from '@/components/ui.tsx';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { CopyField } from '@/components/CopyField.tsx';
import { addPickup, removePickup, deleteInvite } from '../../children/actions.ts';
import { inviteSubUser } from './actions.ts';

export const metadata = { title: 'Pickups & family' };

export default async function FamilyPeople() {
  const ctx = await requireFamily();
  const supabase = await supabaseServer();
  const kids = (await loadFamilyChildren(supabase, ctx)).filter((k) => k.access === 'full');
  const ids = kids.map((k) => k.id);
  const [{ data: pickups }, { data: guardians }, { data: invites }, origin] = await Promise.all([
    supabase.from('pickups').select('*').in('child_id', ids).order('created_at'),
    supabase.from('guardians').select('child_id, profile_id, relationship, access, video_approved, profile:profiles(full_name)').in('child_id', ids),
    supabase.from('invitations').select('id, token, child_id, relationship, email').eq('created_by', ctx.userId).is('accepted_at', null),
    appOrigin(),
  ]);
  const one = (x: any) => (Array.isArray(x) ? x[0] : x);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Pickups & family" subtitle="Who may collect your child, emergency contacts, and family video access" />
      {kids.map((k) => (
        <section key={k.id} className="card space-y-4">
          <h2 className="h2">{k.first_name}</h2>
          <div>
            <div className="label">Family accounts</div>
            <ul className="space-y-1 text-sm">{(guardians ?? []).filter((g) => g.child_id === k.id).map((g: any) => (
              <li key={g.profile_id}>{one(g.profile)?.full_name || 'Family member'} <span className="muted">· {g.relationship}</span> {g.access === 'video_only' && <Badge>video only</Badge>} {!g.video_approved && <Badge tone="amber">video pending</Badge>}</li>
            ))}</ul>
          </div>
          <div>
            <div className="label">Approved pickups & emergency contacts</div>
            <ul className="divide-y divide-rule">{(pickups ?? []).filter((p) => p.child_id === k.id).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-1.5 text-sm">
                <span>{p.name} <span className="muted">{p.relationship ? `· ${p.relationship}` : ''} {p.phone ? `· ${p.phone}` : ''}</span> {p.can_pickup && <Badge tone="green">pickup</Badge>} {p.is_emergency_contact && <Badge tone="amber">emergency</Badge>}</span>
                <form action={removePickup}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="child_id" value={k.id} /><button className="text-xs text-muted hover:text-danger">remove</button></form>
              </li>
            ))}</ul>
            <ActionForm action={addPickup} resetOnSuccess className="mt-2 grid gap-2 sm:grid-cols-3">
              <input type="hidden" name="child_id" value={k.id} />
              <input name="name" placeholder="Full name (as on their ID)" required className="input" />
              <input name="relationship" placeholder="Relationship" className="input" />
              <input name="phone" placeholder="Phone" className="input" />
              <label className="text-sm"><input type="checkbox" name="can_pickup" defaultChecked /> May pick up</label>
              <label className="text-sm"><input type="checkbox" name="is_emergency_contact" /> Emergency contact</label>
              <SubmitButton className="btn-secondary">Add person</SubmitButton>
            </ActionForm>
          </div>
          <div>
            <div className="label">Invite a grandparent or relative to watch video</div>
            {(invites ?? []).filter((i) => i.child_id === k.id).map((i) => (
              <div key={i.id} className="mb-2 rounded-lg bg-canvas p-2">
                <div className="mb-1 flex justify-between text-xs"><span>{i.relationship}{i.email ? ` · ${i.email}` : ''}</span>
                  <form action={deleteInvite}><input type="hidden" name="id" value={i.id} /><button className="text-muted hover:text-danger">cancel</button></form></div>
                <CopyField value={`${origin}/join/${i.token}`} />
              </div>
            ))}
            <ActionForm action={inviteSubUser} className="grid gap-2 sm:grid-cols-3">
              <input type="hidden" name="child_id" value={k.id} />
              <Field label="Relationship"><input name="relationship" placeholder="e.g. grandmother" className="input" /></Field>
              <Field label="Their email"><input name="email" type="email" required className="input" /></Field>
              <div className="flex items-end"><SubmitButton className="btn-secondary w-full">Create link</SubmitButton></div>
            </ActionForm>
            <p className="muted mt-1 text-xs">They will see live video only (no reports, messages or billing), after the school approves them.</p>
          </div>
        </section>
      ))}
    </div>
  );
}
