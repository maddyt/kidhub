import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export const PDF_URL_TTL_SECONDS = 10 * 60;

export interface PacketRequestRow {
  id: string;
  school_id: string;
  child_id: string | null;
  requested_by: string | null;
  topic: string;
  developmental_plane: string;
  subject_category: string;
  status: 'draft' | 'manifest_ready' | 'compiled' | 'failed';
  manifest: unknown;
  pdf_path: string | null;
  page_count: number | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS = 'id, school_id, child_id, requested_by, topic, developmental_plane, subject_category, status, manifest, pdf_path, page_count, error, created_at, updated_at';

export async function listPacketRequests(supabase: SupabaseClient, schoolId: string, limit = 50): Promise<PacketRequestRow[]> {
  const { data } = await supabase.from('packet_requests').select(COLUMNS)
    .eq('school_id', schoolId).order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as PacketRequestRow[];
}

export async function listPacketRequestsForChild(supabase: SupabaseClient, childId: string, limit = 50): Promise<PacketRequestRow[]> {
  const { data } = await supabase.from('packet_requests').select(COLUMNS)
    .eq('child_id', childId).order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as PacketRequestRow[];
}

export async function getPacketRequest(supabase: SupabaseClient, id: string): Promise<PacketRequestRow | null> {
  const { data } = await supabase.from('packet_requests').select(COLUMNS).eq('id', id).maybeSingle();
  return (data as PacketRequestRow | null) ?? null;
}

export async function createPacketRequest(supabase: SupabaseClient, row: {
  school_id: string; child_id: string | null; requested_by: string; topic: string;
  developmental_plane: string; subject_category: string;
}): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase.from('packet_requests').insert(row).select('id').single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

export async function markManifestReady(supabase: SupabaseClient, id: string, manifest: unknown) {
  return supabase.from('packet_requests').update({ status: 'manifest_ready', manifest, error: null }).eq('id', id);
}

export async function markCompiled(supabase: SupabaseClient, id: string, pdfPath: string, pageCount: number) {
  return supabase.from('packet_requests').update({ status: 'compiled', pdf_path: pdfPath, page_count: pageCount, error: null }).eq('id', id);
}

export async function markFailed(supabase: SupabaseClient, id: string, error: string) {
  return supabase.from('packet_requests').update({ status: 'failed', error }).eq('id', id);
}

/** Short-lived signed URL for a compiled packet PDF, same pattern as signed photo URLs. */
export async function signPacketPdf(supabase: SupabaseClient, path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('packets').createSignedUrl(path, PDF_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

export async function uploadPacketPdf(supabase: SupabaseClient, schoolId: string, requestId: string, bytes: Uint8Array): Promise<string> {
  const path = `${schoolId}/${requestId}/packet.pdf`;
  const { error } = await supabase.storage.from('packets').upload(path, bytes, { contentType: 'application/pdf', upsert: true });
  if (error) throw new Error(`Packet PDF upload failed: ${error.message}`);
  return path;
}

export async function uploadPacketImage(supabase: SupabaseClient, schoolId: string, requestId: string, termName: string, bytes: Uint8Array): Promise<string> {
  const slug = termName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '') || 'term';
  const path = `${schoolId}/${requestId}/${slug}-${crypto.randomUUID().slice(0, 8)}.jpg`;
  const { error } = await supabase.storage.from('packets').upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw new Error(`Illustration upload failed: ${error.message}`);
  return path;
}

export async function insertPacketAsset(supabase: SupabaseClient, requestId: string, termName: string, kind: 'base' | 'highlight', imagePath: string | null, vlmPass: boolean, vlmNotes: string, attempt: number) {
  return supabase.from('packet_assets').insert({
    request_id: requestId, term_name: termName, kind, image_path: imagePath, vlm_pass: vlmPass, vlm_notes: vlmNotes.slice(0, 500), attempt,
  });
}
