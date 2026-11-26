import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/context.ts';
import { supabaseServer } from '@/lib/supabase/server.ts';
import { getPacketRequest, signPacketPdf } from '@/lib/data/packets.ts';
import { packetSummary, PLANE_INFO, type Plane, type PacketManifest } from '@/lib/domain/packets.ts';
import { PageHeader, Badge, Notice } from '@/components/ui.tsx';

export const metadata = { title: 'Packet' };

export default async function PacketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(); // RLS decides whether this specific row is visible
  const supabase = await supabaseServer();
  const row = await getPacketRequest(supabase, id);
  if (!row) notFound();

  const manifest = row.manifest as PacketManifest | null;
  const summary = manifest ? packetSummary(manifest) : null;
  const pdfUrl = row.pdf_path ? await signPacketPdf(supabase, row.pdf_path) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={row.topic} subtitle={`${PLANE_INFO[row.developmental_plane as Plane]?.label ?? row.developmental_plane} · ${row.subject_category}`} />

      {row.status === 'failed' && <Notice tone="red">{row.error ?? 'This packet could not be generated.'}</Notice>}
      {row.status !== 'compiled' && row.status !== 'failed' && <Notice tone="amber">Still working on this packet — refresh in a moment.</Notice>}

      {manifest && (
        <section className="card space-y-3">
          <h2 className="h2">Cosmic Story Hook</h2>
          <p className="text-sm">{manifest.cosmic_story_hook}</p>
          <h2 className="h2">Vocabulary</h2>
          <ul className="flex flex-wrap gap-1.5">
            {manifest.vocabulary_set.map((t) => <Badge key={t.term_name}>{t.term_name}</Badge>)}
          </ul>
          <h2 className="h2">{manifest.control_of_error_activity.title}</h2>
          <ul className="list-disc pl-5 text-sm">{manifest.control_of_error_activity.materials_needed.map((m) => <li key={m}>{m}</li>)}</ul>
        </section>
      )}

      {summary && (
        <section className="card">
          <h2 className="h2 mb-2">Packet contents</h2>
          <ul className="text-sm text-muted">
            <li>{summary.vocabularyTermCount} vocabulary terms</li>
            <li>{summary.labelStrips > 0 ? `${summary.labelStrips} label strips` : `${summary.definitionCards} definition cards (front + self-check back)`}</li>
            <li>1 Cosmic Story Hook page</li>
            <li>1 Control of Error activity (front + self-verification key)</li>
            {row.page_count != null && <li>{row.page_count} printed pages total</li>}
          </ul>
        </section>
      )}

      {pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-primary inline-block">Download / print PDF</a>
      )}
    </div>
  );
}
