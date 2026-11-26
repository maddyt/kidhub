'use server';
import { requireUser } from '@/lib/context.ts';
import { PLANES, SUBJECTS, type Plane, type Subject } from '@/lib/domain/packets.ts';
import { searchPdfSuggestions, type PdfSuggestion } from '@/lib/packets/pdf-search.ts';
import { allow, LIMITS, TOO_MANY } from '@/lib/security/rate-limit.ts';

export type PdfSearchResult = { error?: string; topic?: string; suggestions?: PdfSuggestion[] } | null;

export async function findExistingPdfs(_: PdfSearchResult, form: FormData): Promise<PdfSearchResult> {
  const ctx = await requireUser();
  if (!ctx.isStaff && !ctx.guardianOf.some((g) => g.access === 'full')) {
    return { error: 'You do not have access to packet search.' };
  }
  const topic = String(form.get('topic') ?? '').trim();
  const plane = String(form.get('developmental_plane') ?? '');
  const subject = String(form.get('subject_category') ?? '');
  if (!topic || topic.length > 200) return { error: 'Enter a topic of up to 200 characters.' };
  if (!PLANES.includes(plane as Plane)) return { error: 'Pick a developmental plane.' };
  if (!SUBJECTS.includes(subject as Subject)) return { error: 'Pick a subject area.' };
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return { error: 'PDF search is not configured. Ask your administrator to set BRAVE_SEARCH_API_KEY.' };
  if (!(await allow(`packet-search:${ctx.userId}`, LIMITS.packetSearchUser))) return { error: TOO_MANY };
  try {
    const suggestions = await searchPdfSuggestions(apiKey, topic, plane as Plane, subject as Subject);
    return { topic, suggestions };
  } catch {
    console.error('PDF search failed');
    return { error: 'Could not search for PDFs right now. Please try again later.' };
  }
}
