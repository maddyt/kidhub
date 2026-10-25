import { redirect } from 'next/navigation';
import { getContext } from '@/lib/context.ts';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { verifyCode, signOutFromMfa } from './actions.ts';

export const metadata = { title: 'Two-step verification' };

export default async function MfaChallenge() {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (!ctx.mfa.needsChallenge) redirect('/');
  return (
    <div className="mx-auto max-w-sm space-y-4 p-4 py-16">
      <div className="text-center text-4xl" aria-hidden>🔐</div>
      <h1 className="h1 text-center">Enter your code</h1>
      <p className="muted text-center">Open your authenticator app and enter the 6-digit code for KidHub.</p>
      <div className="card">
        <ActionForm action={verifyCode} className="space-y-3">
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus
            className="input text-center text-2xl tracking-[0.4em]" aria-label="6-digit code" />
          <SubmitButton className="btn-primary w-full" pendingText="Checking…">Verify</SubmitButton>
        </ActionForm>
      </div>
      <form action={signOutFromMfa} className="text-center"><button className="muted text-xs underline">Sign out</button></form>
      <p className="muted text-center text-xs">Lost your phone? Ask your organization owner to reset two-step verification for you.</p>
    </div>
  );
}
