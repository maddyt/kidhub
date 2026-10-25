import { redirect } from 'next/navigation';
import { getContext } from '@/lib/context.ts';
import { EnrollForm } from './EnrollForm.tsx';
import { signOutFromMfa } from '../actions.ts';

export const metadata = { title: 'Set up two-step verification' };

export default async function MfaSetup() {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  if (ctx.mfa.needsChallenge) redirect('/mfa');
  if (ctx.mfa.enabled) redirect('/account');
  return (
    <div className="mx-auto max-w-sm space-y-4 p-4 py-12">
      <div className="text-center text-4xl" aria-hidden>🔐</div>
      <h1 className="h1 text-center">Protect your account</h1>
      <p className="muted text-center">
        {ctx.mfa.needsSetup
          ? 'Owners and directors can see every family’s information, so KidHub requires a second step when you sign in: a code from an app on your phone.'
          : 'Add a second step when you sign in: a code from an app on your phone.'}
      </p>
      <div className="card"><EnrollForm /></div>
      <form action={signOutFromMfa} className="text-center"><button className="muted text-xs underline">Sign out</button></form>
    </div>
  );
}
