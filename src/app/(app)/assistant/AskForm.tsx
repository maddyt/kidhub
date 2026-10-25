'use client';
import { useActionState, useRef } from 'react';
import { ask, type AskState } from './actions.ts';

const EXAMPLES = [
  'Which families are overdue, and by how much?',
  'Are any rooms out of ratio right now?',
  'Whose certifications expire in the next 60 days?',
  'Which children have attended fewer than 10 days this month?',
  'How many open spots does each classroom have, and who is on the waitlist?',
  'Summarize what needs my attention today across all schools.',
];

export function AskForm() {
  const [state, action, pending] = useActionState<AskState, FormData>(ask, null);
  const input = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-4">
      <form action={action} className="card space-y-3">
        <textarea ref={input} name="question" rows={3} defaultValue={state?.question} placeholder="Ask about billing, attendance, ratios, staff or enrollment…" className="input" />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" disabled={pending}>{pending ? 'Thinking…' : 'Ask'}</button>
          <span className="muted text-xs">Answers come from your center’s data. The assistant flags and explains; you decide.</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((q) => (
            <button key={q} type="button" className="chip border border-rule bg-white hover:bg-canvas" onClick={() => { if (input.current) input.current.value = q; }}>{q}</button>
          ))}
        </div>
      </form>
      {state?.error && <div className="card border-danger/30 text-sm text-danger">{state.error}</div>}
      {state?.answer && (
        <div className="card">
          <div className="label">Answer</div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{state.answer}</div>
        </div>
      )}
    </div>
  );
}
