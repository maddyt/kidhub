'use client';
import { useActionState } from 'react';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { startEnroll, finishEnroll, type EnrollState } from '../actions.ts';

export function EnrollForm() {
  const [state, start, starting] = useActionState<EnrollState>(startEnroll, null);
  if (!state?.factorId) {
    return (
      <form action={start} className="space-y-2">
        <button className="btn-primary w-full" disabled={starting}>{starting ? 'Preparing…' : 'Set up authenticator app'}</button>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      </form>
    );
  }
  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Install an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy…).</li>
        <li>Scan this QR code with it.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={state.qr} alt="QR code for your authenticator app" className="mx-auto h-48 w-48 rounded-lg border border-rule bg-white p-2" />
      <details className="text-xs text-muted"><summary className="cursor-pointer">Can’t scan? Enter this key instead</summary>
        <code className="mt-1 block break-all rounded bg-canvas p-2">{state.secret}</code></details>
      <ActionForm action={finishEnroll} className="space-y-2">
        <input type="hidden" name="factor_id" value={state.factorId} />
        <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="input text-center text-xl tracking-[0.3em]" aria-label="6-digit code" />
        <SubmitButton className="btn-primary w-full" pendingText="Checking…">Turn on two-step verification</SubmitButton>
      </ActionForm>
    </div>
  );
}
