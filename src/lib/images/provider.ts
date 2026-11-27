import 'server-only';

/**
 * Subsystem B (illustration generation). Two providers, switched with IMAGE_PROVIDER ('gemini',
 * the default, or 'fal') so they can be A/B compared without a code change:
 *
 * - Google Gemini (Nano Banana 2 / gemini-3.1-flash-image), the default: a single synchronous
 *   call (generateContent). First real comparison run: 4 of 4 illustrations passed the VLM judge
 *   on the first attempt, no retries needed — clean white backgrounds, no embedded text.
 * - fal.ai (FLUX Schnell): a single synchronous REST call (fal.run blocks until the image is
 *   ready, no job polling), typically returns in a few seconds, but its instruction-following was
 *   weak even after tightening the prompt — around 1 in 4 illustrations passed the same judge in
 *   the same comparison run. Kept as a fallback option, not the default, until it's worth another
 *   look (see docs/PACKET-GENERATOR.md).
 *
 * Both can return JPEG or PNG depending on the response; pdf-writer.ts embeds either.
 * No npm dependency for either provider: plain fetch, same pattern as every other integration here.
 */
export type ImageProvider = 'fal' | 'gemini';

function activeProvider(): ImageProvider {
  return (process.env.IMAGE_PROVIDER ?? 'gemini').toLowerCase() === 'fal' ? 'fal' : 'gemini';
}

export function imageGenerationConfigured(): boolean {
  return activeProvider() === 'gemini' ? Boolean(process.env.GOOGLE_API_KEY) : Boolean(process.env.FAL_API_KEY);
}

export interface GeneratedImage { bytes: Uint8Array; mediaType: 'image/jpeg' | 'image/png' }

/**
 * Prompt shared by both providers. Rewritten after the first real test run: FLUX kept adding
 * embedded text labels with leader lines (likely invited by the earlier "field-guide plate"
 * framing, since field guides conventionally ARE labeled) and a faintly off-white/mottled
 * background instead of pure #FFFFFF. This drops that framing and states both constraints as
 * explicit, repeated, hard requirements instead of one soft mention each.
 */
function buildPrompt(topic: string, termName: string, highlightRegion?: string): string {
  let prompt = `A single isolated scientific specimen illustration of "${termName}" (for a study of "${topic}"), painted in a realistic, detailed natural-history style — accurate anatomy, no cartoon or cute stylization.

Background: a single flat, seamless, pure white (#FFFFFF) backdrop, like a studio product photo on white seamless paper. No gradient, no vignette, no shadow, no off-white or cream tint, no texture or mottling of any kind in the background — it must read as flat, uniform #FFFFFF.

This is NOT a labeled diagram. Do not include any text, letters, numbers, captions, labels, arrows, or leader lines anywhere in the image — only the illustrated subject itself, nothing else.

The subject must be fully visible and centered, not cropped at any edge, with no border or frame around it.`;
  if (highlightRegion) {
    prompt += `\n\nOne more instruction: highlight only the ${highlightRegion} in a vivid crimson red (#C8102E). Every other part of the subject keeps its natural illustration colors, unchanged.`;
  }
  return prompt;
}

const FAL_MODEL = 'fal-ai/flux/schnell';
const FAL_ENDPOINT = `https://fal.run/${FAL_MODEL}`;

interface FalImage { url: string; content_type?: string }
interface FalResponse { images?: FalImage[] }

async function generateWithFal(prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) throw new Error('No image-generation provider is configured (FAL_API_KEY is unset).');

  const response = await fetch(FAL_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: 'square_hd', num_images: 1, enable_safety_checker: true }),
  });
  if (!response.ok) throw new Error(`fal.ai request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const data = (await response.json()) as FalResponse;
  const image = data.images?.[0];
  if (!image?.url) throw new Error('fal.ai response did not include an image.');

  const imageResponse = await fetch(image.url);
  if (!imageResponse.ok) throw new Error(`Could not download the generated image (${imageResponse.status}).`);
  const bytes = new Uint8Array(await imageResponse.arrayBuffer());
  const mediaType = image.content_type === 'image/png' ? 'image/png' : 'image/jpeg';
  return { bytes, mediaType };
}

const GEMINI_MODEL = 'gemini-3.1-flash-image';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiInlineData { mimeType?: string; data?: string }
interface GeminiPart { inlineData?: GeminiInlineData }
interface GeminiResponse { candidates?: { content?: { parts?: GeminiPart[] } }[] }

async function generateWithGemini(prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('No image-generation provider is configured (GOOGLE_API_KEY is unset).');

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });
  if (!response.ok) throw new Error(`Gemini request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  const data = (await response.json()) as GeminiResponse;
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  const inline = part?.inlineData;
  if (!inline?.data) throw new Error('Gemini response did not include an image.');

  const bytes = new Uint8Array(Buffer.from(inline.data, 'base64'));
  const mediaType = inline.mimeType === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  return { bytes, mediaType };
}

/**
 * Generates one isolated scientific illustration. `highlightRegion`, when set, asks for a
 * variant with only that part highlighted in Montessori Crimson — prompted directly rather than
 * true image-to-image masking (no segmentation model is wired up; see docs/PACKET-GENERATOR.md),
 * so consistency with the base image is not guaranteed. That's what judgeIllustration() in
 * src/lib/ai/packets.ts is for: it catches an illustration that drifted too far and the
 * pipeline retries.
 */
export async function generateIllustration(topic: string, termName: string, highlightRegion?: string): Promise<GeneratedImage> {
  const prompt = buildPrompt(topic, termName, highlightRegion);
  return activeProvider() === 'gemini' ? generateWithGemini(prompt) : generateWithFal(prompt);
}
