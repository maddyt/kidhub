import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { Field, Notice } from '@/components/ui.tsx';
import { acceptAsCurrentUser, joinWithNewAccount } from './actions.ts';

export const metadata = { title: 'Join' };

const ROLE_TEXT = { director: 'a director', teacher: 'a teacher', guardian: 'a family member' } as const;

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await supabaseServer();
  const [{ data }, { data: { user } }] = await Promise.all([
    supabase.rpc('invitation_preview', { p_token: token }), supabase.auth.getUser(),
  ]);
  const inv = data?.[0] as { school_name: string; role: keyof typeof ROLE_TEXT; child_first_name: string | null; email: string | null; expired: boolean; accepted: boolean } | undefined;

  return (
    <div className="mx-auto max-w-md p-4 py-10">
      <div className="mb-4 text-center text-4xl" aria-hidden>🌳</div>
      {!inv || inv.expired || inv.accepted ? (
        <Notice tone="amber">This invitation link is {inv?.accepted ? 'already used' : inv?.expired ? 'expired' : 'not valid'}. Ask the school for a new one.</Notice>
      ) : (
        <div className="card space-y-4">
          <div>
            <h1 className="h2">Join {inv.school_name}</h1>
            <p className="muted">You’ve been invited as {ROLE_TEXT[inv.role]}{inv.child_first_name ? ` for ${inv.child_first_name}` : ''}.</p>
          </div>
          {user ? (
            <ActionForm action={acceptAsCurrentUser}>
              <input type="hidden" name="token" value={token} />
              <p className="muted mb-3">Signed in as {user.email}.</p>
              <SubmitButton className="btn-primary w-full">Accept invitation</SubmitButton>
            </ActionForm>
          ) : (
            <>
              <ActionForm action={joinWithNewAccount} className="space-y-3">
                <input type="hidden" name="token" value={token} />
                <Field label="Your name"><input name="full_name" required className="input" /></Field>
                <Field label="Email">
                  {inv.email ? <input name="email" value={inv.email} readOnly className="input bg-canvas" />
                    : <input name="email" type="email" required className="input" />}
                </Field>
                <Field label="Create a password (8+ characters)"><input name="password" type="password" minLength={8} required className="input" /></Field>
                <SubmitButton className="btn-primary w-full" pendingText="Creating account…">Create account & join</SubmitButton>
              </ActionForm>
              <p className="muted text-center text-xs">
                Already have an account? <Link className="underline" href={`/login?next=/join/${token}`}>Sign in</Link> and come back to this link.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
