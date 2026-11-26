import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateManifest, scanForDisallowedLanguage, packetSummary,
  SUBJECTS, SUBJECT_COLOR, PLANES, PLANE_INFO, CARD_GEOMETRY,
  type PacketManifest,
} from '../src/lib/domain/packets.ts';

function validManifest(overrides: Partial<PacketManifest> = {}): PacketManifest {
  return {
    topic: 'Parts of a honeybee',
    developmental_plane: 'lower_elementary_6_9',
    subject_category: 'zoology',
    cosmic_story_hook: 'Long before flowers bloomed, bees learned to dance a secret map in the sunlight, turning pollen into a feast the whole meadow could share.',
    vocabulary_set: Array.from({ length: 6 }, (_, i) => ({
      term_name: `Part ${i}`,
      phonetic_breakdown: 'puhrt',
      redacted_definition: `The _____ is part ${i} of the bee.`,
    })),
    control_of_error_activity: {
      title: 'Build a paper honeycomb',
      materials_needed: ['paper', 'scissors', 'glue'],
      procedure_steps: ['Cut hexagons.', 'Glue them edge to edge.', 'Count the cells.'],
      self_verification_key: 'A real honeycomb cell has exactly six sides — check that every cell you built does too.',
    },
    ...overrides,
  };
}

test('validateManifest accepts a well-formed manifest', () => {
  const result = validateManifest(validManifest());
  assert.equal(result.ok, true);
});

test('validateManifest rejects too few vocabulary terms', () => {
  const result = validateManifest(validManifest({ vocabulary_set: validManifest().vocabulary_set.slice(0, 3) }));
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes('6–10 terms')));
});

test('validateManifest requires the term to be redacted as _____', () => {
  const m = validManifest();
  m.vocabulary_set[0].redacted_definition = 'This has no blank.';
  const result = validateManifest(m);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes('redact')));
});

test('validateManifest rejects an unknown developmental plane or subject', () => {
  assert.equal(validateManifest(validManifest({ developmental_plane: 'toddler' as any })).ok, false);
  assert.equal(validateManifest(validManifest({ subject_category: 'history' as any })).ok, false);
});

test('validateManifest enforces the cosmic_story_hook length window', () => {
  const tooShort = validateManifest(validManifest({ cosmic_story_hook: 'Too short.' }));
  assert.equal(tooShort.ok, false);
});

test('scanForDisallowedLanguage flags comparative/evaluative language, not plain facts', () => {
  const clean = validManifest();
  assert.deepEqual(scanForDisallowedLanguage(clean), []);

  const flagged = validManifest({ cosmic_story_hook: 'This child is far ahead of average classmates in every way, more than words can say here today.' });
  assert.ok(scanForDisallowedLanguage(flagged).length > 0);
});

test('packetSummary: Primary plane gets label strips, no definition cards', () => {
  const summary = packetSummary(validManifest({ developmental_plane: 'primary_3_6' }));
  assert.equal(summary.labelStrips, 6);
  assert.equal(summary.definitionCards, 0);
});

test('packetSummary: Elementary planes get definition cards instead', () => {
  const lower = packetSummary(validManifest({ developmental_plane: 'lower_elementary_6_9' }));
  assert.equal(lower.definitionCards, 6);
  const upper = packetSummary(validManifest({ developmental_plane: 'upper_elementary_9_12' }));
  assert.equal(upper.definitionCards, 6);
});

test('every subject has a color and every plane has display info', () => {
  for (const s of SUBJECTS) assert.match(SUBJECT_COLOR[s], /^#[0-9A-Fa-f]{6}$/);
  for (const p of PLANES) assert.ok(PLANE_INFO[p].label.length > 0);
});

test('card geometry matches the printed Montessori material sizes (in points, 72/inch)', () => {
  assert.equal(CARD_GEOMETRY.controlCard.w, 3.75 * 72);
  assert.equal(CARD_GEOMETRY.controlCard.h, 5 * 72);
  assert.equal(CARD_GEOMETRY.labelStrip.h, 1.25 * 72);
  assert.equal(CARD_GEOMETRY.definitionCard.w, 5 * 72);
});
