import { requireAdmin } from '@/lib/context.ts';
import { env } from '@/lib/env.ts';
import { PageHeader, Notice } from '@/components/ui.tsx';
import { AskForm } from './AskForm.tsx';

export const metadata = { title: 'AI assistant' };

export default async function AssistantPage() {
  const ctx = await requireAdmin();
  const n = ctx.schools.filter((s) => s.role !== 'teacher').length;
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="AI assistant" subtitle={`Questions across billing, rosters, ratios, attendance and certifications for ${n} school${n > 1 ? 's' : ''}`} />
      {!env.anthropicKey() && <Notice tone="amber">Add an <code>ANTHROPIC_API_KEY</code> environment variable to turn the assistant on. Everything else works without it.</Notice>}
      <AskForm />
    </div>
  );
}
