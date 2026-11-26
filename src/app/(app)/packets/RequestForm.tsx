'use client';
import { ActionForm, type ActionResult } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { PLANES, SUBJECTS, PLANE_INFO } from '@/lib/domain/packets.ts';

const SUBJECT_LABEL: Record<string, string> = {
  geography: 'Geography', botany: 'Botany', zoology: 'Zoology', anatomy: 'Anatomy', physics: 'Physics',
  language: 'Language', practical_life: 'Practical Life', mathematics: 'Mathematics', cultural: 'Cultural', sensorial: 'Sensorial',
};

export function RequestForm({ action, children, childRequired = false }: {
  action: (prev: ActionResult, data: FormData) => Promise<ActionResult>;
  children?: { id: string; name: string }[];
  /** Family mode: the requester has no school-wide roster, so a child must be picked. */
  childRequired?: boolean;
}) {
  return (
    <ActionForm action={action} className="space-y-4" resetOnSuccess>
      <label className="block">
        <span className="label">What is the child curious about?</span>
        <input name="topic" className="input" placeholder="e.g. Parts of a honeybee" maxLength={200} required />
      </label>

      <div>
        <span className="label">Developmental plane</span>
        <div className="flex flex-wrap gap-1.5">
          {PLANES.map((p, i) => (
            <label key={p} className="chip cursor-pointer border border-rule bg-white px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-light has-[:checked]:text-brand-dark">
              <input type="radio" name="developmental_plane" value={p} defaultChecked={i === 0} className="sr-only" />
              {PLANE_INFO[p].label} ({PLANE_INFO[p].ageRange})
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="label">Subject area (sets the card color)</span>
        <select name="subject_category" className="input" defaultValue="cultural">
          {SUBJECTS.map((s) => <option key={s} value={s}>{SUBJECT_LABEL[s]}</option>)}
        </select>
      </label>

      {children && children.length > 0 && (
        <label className="block">
          <span className="label">Child{childRequired ? '' : ' (optional)'}</span>
          <select name="child_id" className="input" defaultValue={childRequired && children.length === 1 ? children[0].id : ''} required={childRequired}>
            {!childRequired && <option value="">No specific child</option>}
            {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}

      <SubmitButton pendingText="Compiling… (usually a few seconds)">Generate packet</SubmitButton>
    </ActionForm>
  );
}
