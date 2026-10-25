'use server';
import Anthropic from '@anthropic-ai/sdk';
import { requireAdmin, alertScope } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { askAssistant, buildAssistantContext } from '@/lib/ai/assistant.ts';
import { env } from '@/lib/env.ts';
import { allow, LIMITS, TOO_MANY } from '@/lib/security/rate-limit.ts';

export type AskState = { question?: string; answer?: string; error?: string } | null;

export async function ask(_: AskState, form: FormData): Promise<AskState> {
  const ctx = await requireAdmin();
  const question = String(form.get('question') ?? '').trim().slice(0, 1000);
  if (!question) return { error: 'Type a question.' };
  if (!(await allow(`assistant:${ctx.userId}`, LIMITS.assistantUser))) return { question, error: TOO_MANY };
  if (!env.anthropicKey()) return { question, error: 'The AI assistant is not configured. Add ANTHROPIC_API_KEY in your Vercel project settings.' };
  try {
    const supabase = await supabaseServer();
    // Only data this admin can already see (RLS), only for schools they run.
    const context = await buildAssistantContext(supabase, alertScope(ctx));
    return { question, answer: await askAssistant(question, context) };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { question, error: 'The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.' };
    if (e instanceof Anthropic.RateLimitError) return { question, error: 'The assistant is busy. Try again in a minute.' };
    if (e instanceof Anthropic.APIError) return { question, error: `The AI service returned an error (${e.status}).` };
    return { question, error: e instanceof Error ? e.message : 'Something went wrong.' };
  }
}
