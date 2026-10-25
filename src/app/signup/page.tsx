import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { Field } from '@/components/ui.tsx';
import { US_TIMEZONES } from '@/lib/timezones.ts';
import { signupOwner } from './actions.ts';

export const metadata = { title: 'Create organization' };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-lg p-4 py-10">
      <h1 className="h1">Set up your schools</h1>
      <p className="muted mb-5">Create the owner account for your school group. You can add more schools, staff and families after this.</p>
      <div className="card">
        <ActionForm action={signupOwner} className="grid gap-3">
          <Field label="Your name"><input name="full_name" required className="input" /></Field>
          <Field label="Email"><input name="email" type="email" required className="input" /></Field>
          <Field label="Password (10+ characters)"><input name="password" type="password" minLength={10} required autoComplete="new-password" className="input" /></Field>
          <Field label="Organization name"><input name="org" required placeholder="e.g. Sunrise Early Learning" className="input" /></Field>
          <Field label="First school / campus"><input name="school" required placeholder="e.g. Main Street campus" className="input" /></Field>
          <Field label="Time zone">
            <select name="timezone" className="input" defaultValue="America/Los_Angeles">
              {US_TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
          <Field label="Sign-up code"><input name="code" required className="input" /></Field>
          <SubmitButton pendingText="Creating…">Create organization</SubmitButton>
        </ActionForm>
      </div>
      <p className="muted mt-4 text-center"><Link href="/login" className="underline">Back to sign in</Link></p>
    </div>
  );
}
