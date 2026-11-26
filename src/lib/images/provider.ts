import 'server-only';

/**
 * Subsystem B (illustration generation) is not wired to a real provider yet — no vendor is
 * configured, so this module intentionally does nothing until IMAGE_GEN_API_KEY is set.
 * Until then, the Packet Generator still produces a complete PDF of text-only materials
 * (label strips, definition cards, the story and activity sheet) and simply skips the
 * illustrated picture/control cards. See docs/PACKET-GENERATOR.md "What ships today."
 */
export function imageGenerationConfigured(): boolean {
  return Boolean(process.env.IMAGE_GEN_API_KEY);
}

export interface GeneratedImage { base64: string; mediaType: 'image/png' | 'image/jpeg' }

/**
 * Generates one isolated scientific illustration on a pure white background.
 * `highlightRegion`, when set, asks for a variant with only that part highlighted in
 * Montessori Crimson (#C8102E), keeping the rest of the illustration unchanged.
 *
 * Throws until a provider is configured — callers must check `imageGenerationConfigured()`
 * first and treat illustrations as optional, exactly as this repo already treats Mux and SMTP.
 */
export async function generateIllustration(_topic: string, _termName: string, _highlightRegion?: string): Promise<GeneratedImage> {
  throw new Error(
    'No image-generation provider is configured (IMAGE_GEN_API_KEY is unset). ' +
    'Add one in src/lib/images/provider.ts — picture and control cards will start rendering automatically once it returns images.'
  );
}
