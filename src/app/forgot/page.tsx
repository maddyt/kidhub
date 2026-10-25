import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { Field } from '@/components/ui.tsx';
import { requestReset } from './actions.ts';

export const metadata = { title: 'Reset password' };

export default function ForgotPage() {
  return (
    <div className="mx-auto max-w-sm space-y-4 p-4 py-16">
      <h1 className="h1">Reset your password</h1>
      <p className="muted">We’ll email you a link to choose a new password.</p>
      <div className="card">
        <ActionForm action={requestReset} className="space-y-3">
          <Field label="Email"><input name="email" type="email" required autoComplete="email" className="input" /></Field>
          <SubmitButton className="btn-primary w-full" pendingText="Sending…">Send reset link</SubmitButton>
        </ActionForm>
      </div>
      <p className="text-center"><Link href="/login" className="muted underline">Back to sign in</Link></p>
    </div>
  );
}
