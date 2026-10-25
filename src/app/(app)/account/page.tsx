import Link from 'next/link';
import { requireUser } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { isDemoAccount } from '@/lib/security/mfa.ts';
import { PageHeader, Field, Badge, Notice } from '@/components/ui.tsx';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { updateName, changePassword, disableMfa } from './actions.ts';

export const metadata = { title: 'Account' };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ mfa?: string; recovery?: string }> }) {
  const ctx = await requireUser();
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('id', ctx.userId).single();
  const demo = isDemoAccount(ctx.email);
  return (
    <div className="max-w-xl space-y-5">
      <PageHeader title="Your account" subtitle={ctx.email} />
      {sp.mfa === 'on' && <Notice>Two-step verification is on. You’ll enter a code from your app each time you sign in.</Notice>}
      {sp.recovery && <Notice tone="amber">Choose a new password below to finish resetting it.</Notice>}
      {demo && <Notice tone="amber">This is a shared demo account. Password and security changes are disabled.</Notice>}

      <section className="card">
        <h2 className="h2 mb-3">Profile</h2>
        <ActionForm action={updateName} className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input name="full_name" defaultValue={profile?.full_name ?? ''} required className="input" /></Field>
          <Field label="Phone"><input name="phone" defaultValue={profile?.phone ?? ''} className="input" /></Field>
          <div><SubmitButton disabled={demo}>Save</SubmitButton></div>
        </ActionForm>
      </section>

      <section className="card">
        <h2 className="h2 mb-1">Two-step verification {ctx.mfa.enabled ? <Badge tone="green">on</Badge> : <Badge tone="amber">off</Badge>}</h2>
        <p className="muted mb-3">A code from an app on your phone, in addition to your password, so a stolen password alone can’t open your account.</p>
        {!ctx.mfa.enabled
          ? (demo ? <p className="muted">Not available on demo accounts.</p> : <Link href="/mfa/setup" className="btn-primary">Turn on</Link>)
          : <ActionForm action={disableMfa}><SubmitButton className="btn-danger" pendingText="Turning off…">Turn off</SubmitButton></ActionForm>}
      </section>

      <section className="card">
        <h2 className="h2 mb-3">Change password</h2>
        <ActionForm action={changePassword} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
          <Field label="New password (10+ characters)"><input name="password" type="password" minLength={10} required autoComplete="new-password" className="input" /></Field>
          <Field label="Confirm"><input name="confirm" type="password" minLength={10} required autoComplete="new-password" className="input" /></Field>
          <div><SubmitButton disabled={demo}>Change password</SubmitButton></div>
        </ActionForm>
      </section>
    </div>
  );
}
