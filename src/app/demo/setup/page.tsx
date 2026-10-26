import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { Field, Notice } from '@/components/ui.tsx';
import { env } from '@/lib/env.ts';
import { setupDemo } from './actions.ts';

export const metadata = { title: 'Set up demo' };
export const maxDuration = 60;

export default function DemoSetupPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 p-4 py-10">
      <h1 className="h1">Set up demo data</h1>
      <p className="muted">Creates the Bright Star Children’s Montessori demo (two campuses) with fictional sample children, staff, parents, invoices and cameras, dated today.
        Running it again resets the demo to a fresh day. It never touches your real schools.</p>
      {!env.demoMode() ? <Notice tone="amber">Demo mode is off (NEXT_PUBLIC_DEMO_MODE is not “true”).</Notice> : (
        <div className="card space-y-4">
          <ActionForm action={setupDemo} className="space-y-3">
            <Field label="Owner sign-up code (OWNER_SIGNUP_CODE)"><input name="code" type="password" required className="input" /></Field>
            <SubmitButton className="btn-primary w-full" pendingText="Creating demo… (about 20 seconds)">Create / reset demo</SubmitButton>
          </ActionForm>
          <ActionForm action={setupDemo} className="border-t border-rule pt-3">
            <input type="hidden" name="remove" value="1" />
            <div className="flex gap-2">
              <input name="code" type="password" required placeholder="Code" className="input" aria-label="Code" />
              <SubmitButton className="btn-danger shrink-0" pendingText="Removing…">Remove demo</SubmitButton>
            </div>
          </ActionForm>
        </div>
      )}
      <p className="text-center"><Link href="/login" className="muted underline">Back to sign in</Link></p>
    </div>
  );
}
