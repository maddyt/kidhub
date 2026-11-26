import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { generateIllustration, imageGenerationConfigured } from '../images/provider.ts';
import { judgeIllustration } from '../ai/packets.ts';
import { uploadPacketImage, insertPacketAsset } from '../data/packets.ts';
import type { PacketManifest } from '../domain/packets.ts';

/**
 * Capped (cost and the Vercel function's time budget) and run in parallel across terms, so the
 * whole packet still compiles in roughly one FLUX call's worth of wall-clock time rather than
 * MAX_ILLUSTRATED_TERMS of them in sequence. See docs/PACKET-GENERATOR.md.
 */
export const MAX_ILLUSTRATED_TERMS = 4;

/**
 * Generates and judges one illustration per vocabulary term (up to the cap). A term that fails
 * every attempt, errors, or comes back in a format the PDF writer can't embed (anything but
 * JPEG) is simply skipped — the packet still compiles without it, text-only for that term.
 * Returns an empty map immediately if no provider is configured.
 */
export async function generateIllustrations(
  supabase: SupabaseClient, schoolId: string, requestId: string, manifest: PacketManifest,
): Promise<Map<string, Uint8Array>> {
  const accepted = new Map<string, Uint8Array>();
  if (!imageGenerationConfigured()) return accepted;

  const terms = manifest.vocabulary_set.slice(0, MAX_ILLUSTRATED_TERMS);
  const results = await Promise.allSettled(
    terms.map((term) => illustrateOne(supabase, schoolId, requestId, manifest.topic, term.term_name)),
  );
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) accepted.set(terms[i].term_name, result.value);
  });
  return accepted;
}

async function illustrateOne(supabase: SupabaseClient, schoolId: string, requestId: string, topic: string, termName: string): Promise<Uint8Array | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    let image: Awaited<ReturnType<typeof generateIllustration>>;
    try {
      image = await generateIllustration(topic, termName);
    } catch (e) {
      await insertPacketAsset(supabase, requestId, termName, 'base', null, false, e instanceof Error ? e.message : 'Generation failed.', attempt);
      continue;
    }
    if (image.mediaType !== 'image/jpeg') {
      await insertPacketAsset(supabase, requestId, termName, 'base', null, false, `Can't embed ${image.mediaType} in the PDF yet — only JPEG.`, attempt);
      continue;
    }

    const judged = await judgeIllustration(Buffer.from(image.bytes).toString('base64'), 'image/jpeg');
    if (!judged.pass) {
      await insertPacketAsset(supabase, requestId, termName, 'base', null, false, judged.notes, attempt);
      continue;
    }

    const path = await uploadPacketImage(supabase, schoolId, requestId, termName, image.bytes);
    await insertPacketAsset(supabase, requestId, termName, 'base', path, true, judged.notes, attempt);
    return image.bytes;
  }
  return null;
}
