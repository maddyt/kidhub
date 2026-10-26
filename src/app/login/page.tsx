import Link from 'next/link';
import { ActionForm } from '@/components/ActionForm.tsx';
import { SubmitButton } from '@/components/SubmitButton.tsx';
import { Field, Notice } from '@/components/ui.tsx';
import { env } from '@/lib/env.ts';
import { DEMO_ACCOUNTS } from '@/lib/demo.ts';
import { login, demoLogin } from './actions.ts';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; demo?: string; reset?: string }> }) {
  const { next, demo, reset } = await searchParams;
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-4">
      <div className="text-center">
        <div className="text-4xl" aria-hidden>🌳</div>
        <h1 className="h1 mt-2">KidHub</h1>
        <p className="muted">Attendance, daily reports, billing, messaging and live video in one app.</p>
      </div>
      {reset === 'failed' && <Notice tone="amber">That reset link is invalid or has expired. Request a new one.</Notice>}
      {!configured && <Notice tone="red">Supabase is not configured yet. Add the environment variables from <code>.env.example</code>.</Notice>}
      <div className="card">
        <ActionForm action={login} className="space-y-3">
          <input type="hidden" name="next" value={next ?? ''} />
          <Field label="Email"><input name="email" type="email" required autoComplete="email" className="input" /></Field>
          <Field label="Password"><input name="password" type="password" required autoComplete="current-password" className="input" /></Field>
          <SubmitButton className="btn-primary w-full" pendingText="Signing in…">Sign in</SubmitButton>
          <p className="text-right text-xs"><Link href="/forgot" className="text-muted underline">Forgot password?</Link></p>
        </ActionForm>
        <p className="muted mt-3 text-center text-xs">
          Got an invitation link? Open it to create your account. Setting up a new school group? <Link href="/signup" className="text-brand underline">Create an organization</Link>.
        </p>
      </div>
      {env.demoMode() && (
        <div className="card">
          <h2 className="h2">Try the demo</h2>
          <p className="muted mb-3">Sign in as a sample user at Bright Star Children’s Montessori. Children, families and records are fictional sample data.</p>
          {demo === 'missing' && <Notice tone="amber">Demo accounts not found yet. <Link href="/demo/setup" className="underline">Set up demo data</Link> first (takes about 20 seconds).</Notice>}
          {demo === 'busy' && <Notice tone="amber">Too many demo sign-ins from your network. Please wait a few minutes.</Notice>}
          {demo === 'ready' && <Notice>Demo data is ready. Pick a role below.</Notice>}
          <form action={demoLogin} className="mt-2 grid gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.key} name="who" value={a.key} className="btn-secondary justify-between text-left">
                <span><span className="font-semibold">{a.label}</span> · {a.name}</span>
                <span className="text-xs text-muted">{a.blurb}</span>
              </button>
            ))}
          </form>
          <p className="muted mt-3 text-center text-xs"><Link href="/demo/setup" className="underline">Set up or reset demo data</Link></p>
        </div>
      )}
    </div>
  );
}
