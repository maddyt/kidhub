// Packet Generator domain logic: no network, no Supabase — pure data and validation.
// See docs/PACKET-GENERATOR.md for the product spec this implements.

export const PLANES = ['primary_3_6', 'lower_elementary_6_9', 'upper_elementary_9_12'] as const;
export type Plane = (typeof PLANES)[number];

export const SUBJECTS = [
  'geography', 'botany', 'zoology', 'anatomy', 'physics', 'language',
  'practical_life', 'mathematics', 'cultural', 'sensorial',
] as const;
export type Subject = (typeof SUBJECTS)[number];

export interface PlaneInfo {
  label: string;
  ageRange: string;
  vocabWordLimit: [min: number, max: number];
  cardStructure: '3-part' | '4-part';
  languageGuidance: string;
}

export const PLANE_INFO: Record<Plane, PlaneInfo> = {
  primary_3_6: {
    label: 'Primary', ageRange: 'Ages 3–6', vocabWordLimit: [3, 5], cardStructure: '3-part',
    languageGuidance: '3–5 word concrete labels; simple sensory observation terms.',
  },
  lower_elementary_6_9: {
    label: 'Lower Elementary', ageRange: 'Ages 6–9', vocabWordLimit: [4, 10], cardStructure: '4-part',
    languageGuidance: '4-part definitions; etymology and word origins; cause-and-effect relationships.',
  },
  upper_elementary_9_12: {
    label: 'Upper Elementary', ageRange: 'Ages 9–12', vocabWordLimit: [4, 14], cardStructure: '4-part',
    languageGuidance: 'Complex systems thinking; quantitative measurement prompts.',
  },
};

/**
 * Subject-coded border colors. Only geography/botany/zoology/language/anatomy are specified by
 * the Montessori color-coding convention this follows; the rest default to a neutral gray until
 * a school's own curriculum library (docs/PRD-MONTESSORI.md, not yet built) defines its own areas.
 */
export const SUBJECT_COLOR: Record<Subject, string> = {
  geography: '#0055A5',
  botany: '#2E7D32',
  zoology: '#2E7D32',
  language: '#C8102E',
  anatomy: '#C8102E',
  physics: '#C8102E',
  practical_life: '#6B7280',
  mathematics: '#6B7280',
  cultural: '#6B7280',
  sensorial: '#6B7280',
};

/** Card geometry in PDF points (72pt = 1in), matching the printed Montessori material sizes. */
export const IN = 72;
export const CARD_GEOMETRY = {
  controlCard: { w: 3.75 * IN, h: 5 * IN },
  pictureCard: { w: 3.75 * IN, h: 3.75 * IN },
  labelStrip: { w: 3.75 * IN, h: 1.25 * IN },
  definitionCard: { w: 5 * IN, h: 3.75 * IN },
};
export const LETTER = { w: 8.5 * IN, h: 11 * IN };
export const PAGE_MARGIN = 0.25 * IN;

export interface VocabularyTerm {
  term_name: string;
  phonetic_breakdown?: string;
  redacted_definition: string;
  highlight_region?: string;
}

export interface ControlOfErrorActivity {
  title: string;
  materials_needed: string[];
  procedure_steps: string[];
  self_verification_key: string;
}

export interface PacketManifest {
  topic: string;
  developmental_plane: Plane;
  subject_category: Subject;
  cosmic_story_hook: string;
  vocabulary_set: VocabularyTerm[];
  control_of_error_activity: ControlOfErrorActivity;
}

export type ValidationResult =
  | { ok: true; manifest: PacketManifest }
  | { ok: false; errors: string[] };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Structural validation of an AI-drafted manifest (Subsystem A's schema/fact-check gate). */
export function validateManifest(data: unknown): ValidationResult {
  const errors: string[] = [];
  const d = (data ?? {}) as Record<string, unknown>;

  if (!isNonEmptyString(d.topic) || d.topic.length > 200) errors.push('topic must be a non-empty string up to 200 characters.');
  if (!PLANES.includes(d.developmental_plane as Plane)) errors.push(`developmental_plane must be one of ${PLANES.join(', ')}.`);
  if (!SUBJECTS.includes(d.subject_category as Subject)) errors.push(`subject_category must be one of ${SUBJECTS.join(', ')}.`);
  if (!isNonEmptyString(d.cosmic_story_hook) || d.cosmic_story_hook.length < 50 || d.cosmic_story_hook.length > 500) {
    errors.push('cosmic_story_hook must be 50–500 characters.');
  }

  const vocab = Array.isArray(d.vocabulary_set) ? d.vocabulary_set : [];
  if (vocab.length < 6 || vocab.length > 10) errors.push('vocabulary_set must contain 6–10 terms.');
  vocab.forEach((raw, i) => {
    const t = (raw ?? {}) as Record<string, unknown>;
    if (!isNonEmptyString(t.term_name)) errors.push(`vocabulary_set[${i}].term_name is required.`);
    if (!isNonEmptyString(t.redacted_definition)) errors.push(`vocabulary_set[${i}].redacted_definition is required.`);
    else if (!t.redacted_definition.includes('_____')) errors.push(`vocabulary_set[${i}].redacted_definition must redact the term as "_____".`);
  });

  const activity = (d.control_of_error_activity ?? {}) as Record<string, unknown>;
  if (!isNonEmptyString(activity.title)) errors.push('control_of_error_activity.title is required.');
  if (!Array.isArray(activity.materials_needed) || activity.materials_needed.length === 0) {
    errors.push('control_of_error_activity.materials_needed must list at least one item.');
  }
  if (!Array.isArray(activity.procedure_steps) || activity.procedure_steps.length === 0) {
    errors.push('control_of_error_activity.procedure_steps must list at least one step.');
  }
  if (!isNonEmptyString(activity.self_verification_key)) errors.push('control_of_error_activity.self_verification_key is required.');

  if (errors.length) return { ok: false, errors };
  return { ok: true, manifest: data as PacketManifest };
}

/**
 * KidHub's existing Montessori AI rule (docs/PRD-MONTESSORI.md §8): never grade, rank or compare
 * a child. Flags family-facing text for review rather than silently editing it.
 */
const DISALLOWED_LANGUAGE = [
  'smarter than', 'behind', 'ahead of', 'average', 'below average', 'above average',
  'gifted', '\\biq\\b', 'grade:', 'score:', 'percent', '%', 'ranked',
];
const DISALLOWED_RE = new RegExp(DISALLOWED_LANGUAGE.join('|'), 'i');

export function scanForDisallowedLanguage(manifest: PacketManifest): string[] {
  const hits: string[] = [];
  const check = (label: string, text: string) => { if (DISALLOWED_RE.test(text)) hits.push(`${label}: "${text}"`); };
  check('cosmic_story_hook', manifest.cosmic_story_hook);
  check('control_of_error_activity.self_verification_key', manifest.control_of_error_activity.self_verification_key);
  manifest.vocabulary_set.forEach((t, i) => check(`vocabulary_set[${i}].redacted_definition`, t.redacted_definition));
  return hits;
}

export interface PacketSummary {
  vocabularyTermCount: number;
  controlCards: number;
  labelStrips: number;
  definitionCards: number;
  hasStoryHook: true;
  hasControlOfErrorActivity: true;
}

/** What the compiled PDF will contain, for the "packet overview" summary shown before download. */
export function packetSummary(manifest: PacketManifest): PacketSummary {
  const n = manifest.vocabulary_set.length;
  const includeDefinitionCards = manifest.developmental_plane !== 'primary_3_6';
  return {
    vocabularyTermCount: n,
    controlCards: n,
    labelStrips: n,
    definitionCards: includeDefinitionCards ? n : 0,
    hasStoryHook: true,
    hasControlOfErrorActivity: true,
  };
}
