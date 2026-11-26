'use client';
import { startTransition, useActionState, useEffect, useRef } from 'react';
import type { ActionResult } from '@/components/ActionForm.tsx';
import { PLANES, SUBJECTS, PLANE_INFO } from '@/lib/domain/packets.ts';
import { findExistingPdfs } from './search-actions.ts';

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
  const [state, generate, generating] = useActionState(action, null);
  const [search, findPdfs, searching] = useActionState(findExistingPdfs, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={generate} className="space-y-4">
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

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={generating || searching}>
          {generating ? 'Compiling… (usually a few seconds)' : 'Generate packet'}
        </button>
        <button type="button" onClick={() => {
          if (ref.current) {
            const form = new FormData(ref.current);
            startTransition(() => findPdfs(form));
          }
        }} className="btn-secondary" disabled={generating || searching}>
          {searching ? 'Searching…' : 'Find existing PDFs'}
        </button>
      </div>
      <p className="text-xs text-muted">Searching sends the topic, age range and subject to Brave Search. Do not include personal information.</p>
      {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      {state?.message && <p className="text-sm text-ok" role="status">{state.message}</p>}
      {search?.error && <p className="text-sm text-danger" role="alert">{search.error}</p>}
      {search?.suggestions && (
        <section aria-live="polite" className="space-y-2">
          <h3 className="font-medium">PDF search results for “{search.topic}”</h3>
          <p className="text-xs text-muted">External results may not be free, suitable, or available. Review each resource and its terms before use.</p>
          {search.suggestions.length === 0 ? <p className="text-sm">No matching PDFs found. Try another topic.</p> : (
            <ul className="space-y-3">
              {search.suggestions.map((result) => (
                <li key={result.url} className="text-sm">
                  <a href={result.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-dark hover:underline">{result.title}</a>
                  <p className="break-all text-xs text-muted">{new URL(result.url).hostname}</p>
                  {result.description && <p className="text-muted">{result.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </form>
  );
}
