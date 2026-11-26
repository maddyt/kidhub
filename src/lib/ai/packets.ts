import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.ts';
import { PLANE_INFO, SUBJECTS, validateManifest, scanForDisallowedLanguage, type Plane, type Subject, type PacketManifest } from '../domain/packets.ts';

const SCHEMA = `{
  "topic": string,
  "developmental_plane": "primary_3_6" | "lower_elementary_6_9" | "upper_elementary_9_12",
  "subject_category": "geography" | "botany" | "zoology" | "anatomy" | "physics" | "language" | "practical_life" | "mathematics" | "cultural" | "sensorial",
  "cosmic_story_hook": string (50-500 chars; a vivid 3-sentence real-world narrative introducing why the topic matters, in the spirit of Montessori's Five Great Lessons),
  "vocabulary_set": [ { "term_name": string, "phonetic_breakdown": string, "redacted_definition": string (the definition with the term itself replaced by "_____"), "highlight_region": string } ] (6-10 items),
  "control_of_error_activity": { "title": string, "materials_needed": string[], "procedure_steps": string[], "self_verification_key": string }
}`;

function systemPrompt(plane: Plane): string {
  const info = PLANE_INFO[plane];
  return `You write Montessori curriculum manifests for KidHub's Packet Generator, which compiles your output into printable classroom/home materials.

Calibrate every word to the ${info.label} plane (${info.ageRange}): ${info.languageGuidance}

Output ONLY a single JSON object matching this shape, with no surrounding prose:
${SCHEMA}

Rules:
- Scientific accuracy matters: verify facts before writing them (e.g. an insect has exactly 6 legs and 3 body segments).
- redacted_definition must replace the term itself with "_____" so it can be used as a matching exercise.
- Never use grades, scores, percentages, rankings or comparisons between children or to "average" — this manifest may end up in a child's hands.
- control_of_error_activity must use common household or classroom materials and include a concrete way the child can verify their own result.`;
}

export type GenerateManifestResult =
  | { ok: true; manifest: PacketManifest }
  | { ok: false; error: string };

/** Subsystem A: curiosity prompt → validated curriculum manifest, with one repair retry on a schema/fact-check failure. */
export async function generateManifest(topic: string, plane: Plane, subject: Subject): Promise<GenerateManifestResult> {
  if (!SUBJECTS.includes(subject)) return { ok: false, error: 'Unknown subject category.' };
  const client = new Anthropic({ apiKey: env.anthropicKey() });
  const system = systemPrompt(plane);
  const userTurn = `Curiosity prompt: "${topic}"\nSubject category: ${subject}`;

  let errors: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt = attempt === 1
      ? userTurn
      : `${userTurn}\n\nYour previous attempt failed validation for these reasons — fix them and return the corrected JSON object only:\n${errors.map((e) => `- ${e}`).join('\n')}`;
    let response: Awaited<ReturnType<typeof client.beta.messages.create>>;
    try {
      response = await client.beta.messages.create({
        model: env.anthropicModel(),
        max_tokens: 4000,
        output_config: { effort: 'medium' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The AI service could not be reached.';
      return { ok: false, error: `The AI service returned an error: ${message}` };
    }
    if (response.stop_reason === 'refusal') return { ok: false, error: 'The assistant declined to generate this packet. Try rephrasing the topic.' };
    const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();
    const jsonText = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();

    let parsed: unknown;
    try { parsed = JSON.parse(jsonText); } catch { errors = ['The response was not valid JSON.']; continue; }
    const result = validateManifest(parsed);
    if (!result.ok) { errors = result.errors; continue; }

    // topic/plane/subject are already known from the request — set them from there rather than
    // trusting the model to echo them back correctly. It has gotten the plane wrong before
    // (matching enum value, wrong one), which silently changed which cards the PDF compiler
    // produces (label strips vs. definition cards) since that choice keys off this field.
    const manifest: PacketManifest = { ...result.manifest, topic, developmental_plane: plane, subject_category: subject };

    const flagged = scanForDisallowedLanguage(manifest);
    if (flagged.length) { errors = flagged.map((f) => `Evaluative/comparative language is not allowed: ${f}`); continue; }

    return { ok: true, manifest };
  }
  return { ok: false, error: `Could not produce a valid manifest after retrying: ${errors.join('; ')}` };
}

export interface JudgeResult { pass: boolean; notes: string }

/**
 * Subsystem B's VLM judge, reusing Claude's own vision input instead of a separate vision API.
 * Checks the three criteria from the source spec: pure white background, no embedded text/labels,
 * and that only the named region is highlighted in Montessori Crimson.
 */
export async function judgeIllustration(imageBase64: string, mediaType: 'image/png' | 'image/jpeg', highlightRegion?: string): Promise<JudgeResult> {
  const client = new Anthropic({ apiKey: env.anthropicKey() });
  const criteria = highlightRegion
    ? `3. Highlight accuracy: ONLY "${highlightRegion}" is highlighted in Montessori Crimson (#C8102E); nothing else in the image is red.`
    : '3. Highlight accuracy: not applicable (this is the unhighlighted base image).';
  let response: Awaited<ReturnType<typeof client.beta.messages.create>>;
  try {
    response = await client.beta.messages.create({
      model: env.anthropicModel(),
      max_tokens: 300,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: `You are a strict quality-assurance judge for Montessori scientific illustrations. Check the image against exactly these criteria:
1. Background purity: the background is 100% pure white (#FFFFFF), no edge cropping, no ambient shadows or gradients.
2. Typography isolation: zero embedded text, labels or watermarks anywhere in the image.
${criteria}
Respond with ONLY a JSON object: {"pass": boolean, "notes": "one short sentence"}.`,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: 'Judge this image against the three criteria.' },
        ],
      }],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'The AI service could not be reached.';
    return { pass: false, notes: `Judge call failed: ${message}` };
  }
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
  try {
    const parsed = JSON.parse(text.replace(/^```(json)?/i, '').replace(/```$/, '').trim());
    return { pass: Boolean(parsed.pass), notes: String(parsed.notes ?? '') };
  } catch {
    return { pass: false, notes: 'Judge response could not be parsed.' };
  }
}
