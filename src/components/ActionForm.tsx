'use client';
import { useActionState, useEffect, useRef } from 'react';

export type ActionResult = { ok?: boolean; error?: string; message?: string } | null;

/** A form bound to a server action that returns { error } or { message }, shown inline. */
export function ActionForm({ action, children, className = '', resetOnSuccess = false }: {
  action: (prev: ActionResult, data: FormData) => Promise<ActionResult>;
  children: React.ReactNode; className?: string; resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (resetOnSuccess && state?.ok) ref.current?.reset(); }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error && <p className="mt-2 text-sm text-danger" role="alert">{state.error}</p>}
      {state?.message && <p className="mt-2 text-sm text-ok" role="status">{state.message}</p>}
    </form>
  );
}
