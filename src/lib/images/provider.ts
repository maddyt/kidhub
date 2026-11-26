import 'server-only';

/**
 * Subsystem B (illustration generation) via fal.ai, hosting FLUX — chosen for a simple
 * synchronous REST call (fal.run blocks until the image is ready, no job polling) and for
 * speed: FLUX Schnell typically returns in a few seconds, which matters since this still runs
 * inside one Vercel function call per packet (src/lib/packets/pipeline.ts).
 *
 * No npm dependency: a single fetch call, same pattern as every other integration in this repo.
 */
const FAL_MODEL = 'fal-ai/flux/schnell';
const FAL_ENDPOINT = `https://fal.run/${FAL_MODEL}`;

export function imageGenerationConfigured(): boolean {
  return Boolean(process.env.FAL_API_KEY);
}

export interface GeneratedImage { bytes: Uint8Array; mediaType: 'image/jpeg' | 'image/png' }

interface FalImage { url: string; content_type?: string; width?: number; height?: number }
interface FalResponse { images?: FalImage[]; detail?: unknown }

function buildPrompt(topic: string, termName: string, highlightRegion?: string): string {
  const base = `A realistic scientific illustration of "${termName}", as part of a study of "${topic}", ` +
    'in the style of a classic natural-history field-guide plate: accurate, detailed, no cartoon style. ' +
    'Isolated on a pure solid white (#FFFFFF) background, centered, no shadows, no cropping at the edges, ' +
    'no text, no labels, no watermark, no border.';
  if (!highlightRegion) return base;
  return `${base} Highlight only the ${highlightRegion} in a vivid crimson red (#C8102E); render every other part in its natural illustration colors, unchanged.`;
}

/**
 * Generates one isolated scientific illustration. `highlightRegion`, when set, asks for a
 * variant with only that part highlighted in Montessori Crimson — FLUX is prompted for this
 * directly rather than true image-to-image masking (no segmentation model is wired up; see
 * docs/PACKET-GENERATOR.md), so consistency with the base image is not guaranteed. That's what
 * judgeIllustration() in src/lib/ai/packets.ts is for: it catches an illustration that drifted
 * too far and the pipeline retries.
 */
export async function generateIllustration(topic: string, termName: string, highlightRegion?: string): Promise<GeneratedImage> {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) throw new Error('No image-generation provider is configured (FAL_API_KEY is unset).');

  const response = await fetch(FAL_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: buildPrompt(topic, termName, highlightRegion),
      image_size: 'square_hd',
      num_images: 1,
      enable_safety_checker: true,
    }),
  });
  if (!response.ok) {
    throw new Error(`fal.ai request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
  }
  const data = (await response.json()) as FalResponse;
  const image = data.images?.[0];
  if (!image?.url) throw new Error('fal.ai response did not include an image.');

  const imageResponse = await fetch(image.url);
  if (!imageResponse.ok) throw new Error(`Could not download the generated image (${imageResponse.status}).`);
  const bytes = new Uint8Array(await imageResponse.arrayBuffer());
  const mediaType = image.content_type === 'image/png' ? 'image/png' : 'image/jpeg';
  return { bytes, mediaType };
}
