import { PLANE_INFO, type Plane, type Subject } from '../domain/packets.ts';

export type PdfSuggestion = { title: string; url: string; description: string };

/** Search results are links, not downloaded or verified PDFs. */
export async function searchPdfSuggestions(
  apiKey: string, topic: string, plane: Plane, subject: Subject, fetcher: typeof fetch = fetch,
): Promise<PdfSuggestion[]> {
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', `${topic} ${subject.replaceAll('_', ' ')} ${PLANE_INFO[plane].ageRange} free printable Montessori filetype:pdf`);
  url.searchParams.set('count', '10');
  url.searchParams.set('safesearch', 'strict');
  const response = await fetcher(url, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`PDF search provider returned HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid PDF search response');
  const web = (data as { web?: unknown }).web;
  if (web === undefined) return [];
  if (!web || typeof web !== 'object' || !Array.isArray((web as { results?: unknown }).results)) {
    throw new Error('Invalid PDF search results');
  }
  const results: PdfSuggestion[] = [];
  const seen = new Set<string>();
  for (const item of (web as { results: unknown[] }).results) {
    if (!item || typeof item !== 'object') continue;
    const { title, url: link, description } = item as Record<string, unknown>;
    if (typeof title !== 'string' || !title.trim() || typeof link !== 'string') continue;
    let parsed: URL;
    try { parsed = new URL(link); } catch { continue; }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !/\.pdf$/i.test(parsed.pathname)) continue;
    if (seen.has(parsed.href)) continue;
    seen.add(parsed.href);
    results.push({ title: title.trim(), url: parsed.href, description: typeof description === 'string' ? description : '' });
    if (results.length === 5) break;
  }
  return results;
}
