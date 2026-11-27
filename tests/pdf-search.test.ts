import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchPdfSuggestions } from '../src/lib/packets/pdf-search.ts';

test('search sends the topic and selected context, and returns safe distinct PDF links', async () => {
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin + url.pathname, 'https://api.search.brave.com/res/v1/web/search');
    assert.match(url.searchParams.get('q')!, /honeybee.*zoology.*Ages 3–6.*free printable Montessori filetype:pdf/);
    assert.equal(url.searchParams.get('safesearch'), 'strict');
    assert.equal(new Headers(init?.headers).get('X-Subscription-Token'), 'test-key');
    return Response.json({ web: { results: [
      { title: 'Bee cards', url: 'https://example.org/bee.PDF?download=1', description: 'Cards' },
      { title: 'Duplicate', url: 'https://example.org/bee.PDF?download=1' },
      { title: 'Not a PDF', url: 'https://example.org/pdf' },
      { title: 'Unsafe', url: 'javascript:alert(1)' },
      { title: 'Insecure', url: 'http://example.org/a.pdf' },
      { title: 'Spoofed', url: 'https://user@example.org/a.pdf' },
      { title: '', url: 'https://example.org/empty.pdf' },
      { title: 'Other', url: 'https://example.org/other.pdf' },
    ] } });
  };
  assert.deepEqual(await searchPdfSuggestions('test-key', 'honeybee', 'primary_3_6', 'zoology', fetcher), [
    { title: 'Bee cards', url: 'https://example.org/bee.PDF?download=1', description: 'Cards' },
    { title: 'Other', url: 'https://example.org/other.pdf', description: '' },
  ]);
});

test('search handles empty results and caps suggestions at five', async () => {
  const empty: typeof fetch = async () => Response.json({});
  assert.deepEqual(await searchPdfSuggestions('key', 'leaves', 'upper_elementary_9_12', 'botany', empty), []);
  const many: typeof fetch = async () => Response.json({ web: { results: Array.from({ length: 10 }, (_, i) => ({
    title: `Resource ${i}`, url: `https://example.org/${i}.pdf`,
  })) } });
  assert.equal((await searchPdfSuggestions('key', 'leaves', 'upper_elementary_9_12', 'botany', many)).length, 5);
});

// A live search ("Parts of a honeybee") came back with raw <strong> highlight tags and escaped
// entities in Brave's own snippets, rendered as literal text on the page instead of being clean.
test('search strips HTML tags and decodes entities from Brave\'s snippets', async () => {
  const fetcher: typeof fetch = async () => Response.json({ web: { results: [
    { title: 'Bee <strong>Anatomy</strong> Guide', url: 'https://example.org/bee.pdf', description: 'Covers <strong>head, thorax, abdomen</strong> &amp; the USDA&#x27;s &quot;basics&quot;.' },
  ] } });
  assert.deepEqual(await searchPdfSuggestions('key', 'bees', 'primary_3_6', 'zoology', fetcher), [
    { title: 'Bee Anatomy Guide', url: 'https://example.org/bee.pdf', description: 'Covers head, thorax, abdomen & the USDA\'s "basics".' },
  ]);
});

test('search surfaces provider and malformed response errors', async () => {
  const failure: typeof fetch = async () => new Response(null, { status: 429 });
  await assert.rejects(searchPdfSuggestions('key', 'bees', 'primary_3_6', 'zoology', failure), /HTTP 429/);
  const malformed: typeof fetch = async () => Response.json({ web: { results: 'invalid' } });
  await assert.rejects(searchPdfSuggestions('key', 'bees', 'primary_3_6', 'zoology', malformed), /Invalid PDF search results/);
});
