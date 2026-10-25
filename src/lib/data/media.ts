import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const PHOTO_URL_TTL_SECONDS = 10 * 60;

/** Short-lived (10 minute) signed URLs for private photos, keyed by storage path. Pages re-sign on each load. */
export async function signPhotos(supabase: SupabaseClient, paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const out = new Map<string, string>();
  if (!unique.length) return out;
  const { data } = await supabase.storage.from('media').createSignedUrls(unique, PHOTO_URL_TTL_SECONDS);
  for (const d of data ?? []) if (d.signedUrl && d.path) out.set(d.path, d.signedUrl);
  return out;
}

export async function uploadPhoto(supabase: SupabaseClient, schoolId: string, childId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${schoolId}/${childId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type || 'image/jpeg' });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return path;
}
