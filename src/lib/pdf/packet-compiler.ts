import 'server-only';
import { PdfDocument, hexColor, rgb, wrapText, textWidth, type PdfPage, type RGB } from './pdf-writer.ts';
import {
  CARD_GEOMETRY, LETTER, PAGE_MARGIN, PLANE_INFO, SUBJECT_COLOR,
  type PacketManifest,
} from '../domain/packets.ts';

// Subsystem C: assembles the validated manifest into a print-ready, duplex-mirrored PDF using
// a small hand-rolled writer (src/lib/pdf/pdf-writer.ts) — no illustrations yet (see
// src/lib/images/provider.ts), so this renders every text-based material the source spec calls
// for: label strips (Primary), definition cards (Elementary), the Cosmic Story Hook, and the
// Control of Error activity with its self-verification key on the back.

const TRIM_GRAY = hexColor('#D1D5DB');
const INK = rgb(0.067, 0.094, 0.153);
const MUTED = rgb(0.42, 0.447, 0.502);
const WHITE = rgb(1, 1, 1);

/** 0.25pt hairline crop marks just outside each corner of a card, for single-pass trimming. */
function drawCropMarks(page: PdfPage, x: number, y: number, w: number, h: number) {
  const len = 10, gap = 4;
  const tick = (cx: number, cy: number, horizontal: 1 | -1, vertical: 1 | -1) => {
    page.line(cx + horizontal * gap, cy, cx + horizontal * (gap + len), cy, { width: 0.25, color: TRIM_GRAY });
    page.line(cx, cy + vertical * gap, cx, cy + vertical * (gap + len), { width: 0.25, color: TRIM_GRAY });
  };
  tick(x, y, -1, -1);
  tick(x + w, y, 1, -1);
  tick(x, y + h, -1, 1);
  tick(x + w, y + h, 1, 1);
}

function drawCardFrame(page: PdfPage, x: number, y: number, w: number, h: number, color: RGB) {
  page.rect(x, y, w, h, { fillColor: WHITE, borderColor: color, borderWidth: 2 });
  drawCropMarks(page, x, y, w, h);
}

function drawWrapped(page: PdfPage, text: string, x: number, topY: number, size: number, maxWidth: number, lineGap = 1.3, color: RGB = INK, bold = false): number {
  const lines = wrapText(bold ? 'Helvetica-Bold' : 'Helvetica', text, size, maxWidth);
  lines.forEach((line, i) => page.text(x, topY - i * size * lineGap, line, { size, font: bold ? 'Helvetica-Bold' : 'Helvetica', color }));
  return topY - lines.length * size * lineGap;
}

/** cols-1-col: swaps left/right grid position for the back of a duplex ("flip on long edge") sheet. */
function mirrorColumn(col: number, cols: number): number {
  return cols - 1 - col;
}

export interface CompileResult { bytes: Uint8Array; pageCount: number }

export async function compilePacketPdf(manifest: PacketManifest, schoolName?: string): Promise<CompileResult> {
  const doc = new PdfDocument();
  const barColor = hexColor(SUBJECT_COLOR[manifest.subject_category]);
  const plane = PLANE_INFO[manifest.developmental_plane];

  addCoverPage(doc, manifest, barColor, plane.label, schoolName);
  if (manifest.developmental_plane === 'primary_3_6') addLabelStripPages(doc, manifest, barColor);
  else addDefinitionCardPages(doc, manifest, barColor);
  addActivityPages(doc, manifest, barColor);

  return { bytes: doc.save(), pageCount: doc.pageCount };
}

function addCoverPage(doc: PdfDocument, m: PacketManifest, barColor: RGB, planeLabel: string, schoolName?: string) {
  const page = doc.addPage(LETTER.w, LETTER.h);
  page.rect(0, LETTER.h - 14, LETTER.w, 14, { fillColor: barColor });
  let y = LETTER.h - 72;
  page.text(PAGE_MARGIN, y, m.topic, { size: 26, font: 'Helvetica-Bold', color: INK });
  y -= 30;
  page.text(PAGE_MARGIN, y, `${planeLabel} - ${m.subject_category}${schoolName ? ` - ${schoolName}` : ''}`, { size: 11, font: 'Helvetica', color: MUTED });
  y -= 40;
  page.text(PAGE_MARGIN, y, 'Cosmic Story Hook', { size: 13, font: 'Helvetica-Bold', color: barColor });
  y -= 20;
  drawWrapped(page, m.cosmic_story_hook, PAGE_MARGIN, y, 13, LETTER.w - PAGE_MARGIN * 2, 1.5);
}

function addLabelStripPages(doc: PdfDocument, m: PacketManifest, barColor: RGB) {
  const { w, h } = CARD_GEOMETRY.labelStrip;
  const perPage = 4;
  for (let i = 0; i < m.vocabulary_set.length; i += perPage) {
    const page = doc.addPage(LETTER.w, LETTER.h);
    const x = (LETTER.w - w) / 2;
    const terms = m.vocabulary_set.slice(i, i + perPage);
    terms.forEach((term, row) => {
      const y = LETTER.h - PAGE_MARGIN - (row + 1) * h - row * 10;
      drawCardFrame(page, x, y, w, h, barColor);
      const size = 20;
      const textW = textWidth('Helvetica-Bold', term.term_name, size);
      page.text(x + (w - textW) / 2, y + h / 2 - size / 3, term.term_name, { size, font: 'Helvetica-Bold', color: INK });
    });
  }
}

function addDefinitionCardPages(doc: PdfDocument, m: PacketManifest, barColor: RGB) {
  const { w, h } = CARD_GEOMETRY.definitionCard;
  const cols = 2, rows = 2, perPage = cols * rows;
  const pageW = LETTER.h, pageH = LETTER.w; // landscape: two 5"x3.75" cards fit per row only when rotated
  const gapX = (pageW - PAGE_MARGIN * 2 - cols * w) / (cols - 1 || 1);
  const gapY = (pageH - PAGE_MARGIN * 2 - rows * h) / (rows - 1 || 1);

  for (let i = 0; i < m.vocabulary_set.length; i += perPage) {
    const terms = m.vocabulary_set.slice(i, i + perPage);
    const front = doc.addPage(pageW, pageH);
    const back = doc.addPage(pageW, pageH);
    terms.forEach((term, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const x = PAGE_MARGIN + col * (w + gapX);
      const y = pageH - PAGE_MARGIN - (row + 1) * h - row * gapY;
      drawCardFrame(front, x, y, w, h, barColor);
      drawDefinitionFront(front, term, x, y, w, h, barColor);

      // Mirrored so flip-on-long-edge duplex lines the back up with the matching front card.
      const backCol = mirrorColumn(col, cols);
      const bx = PAGE_MARGIN + backCol * (w + gapX);
      drawCardFrame(back, bx, y, w, h, barColor);
      drawDefinitionBack(back, term, bx, y, w, h);
    });
  }
}

function drawDefinitionFront(page: PdfPage, term: { term_name: string; phonetic_breakdown?: string }, x: number, y: number, w: number, h: number, barColor: RGB) {
  const pad = 14;
  page.text(x + pad, y + h - 32, term.term_name, { size: 18, font: 'Helvetica-Bold', color: INK });
  if (term.phonetic_breakdown) page.text(x + pad, y + h - 52, term.phonetic_breakdown, { size: 11, font: 'Helvetica', color: MUTED });
  page.text(x + pad, y + pad, 'CONTROL CARD - flip for the answer', { size: 8, font: 'Helvetica', color: barColor });
}

function drawDefinitionBack(page: PdfPage, term: { term_name: string; redacted_definition: string }, x: number, y: number, w: number, h: number) {
  const pad = 14;
  const revealed = term.redacted_definition.replace('_____', term.term_name);
  page.text(x + pad, y + h - 26, 'Self-check', { size: 10, font: 'Helvetica-Bold', color: MUTED });
  drawWrapped(page, revealed, x + pad, y + h - 42, 12, w - pad * 2, 1.4);
}

function addActivityPages(doc: PdfDocument, m: PacketManifest, barColor: RGB) {
  const a = m.control_of_error_activity;
  const front = doc.addPage(LETTER.w, LETTER.h);
  front.rect(0, LETTER.h - 14, LETTER.w, 14, { fillColor: barColor });
  let y = LETTER.h - 60;
  front.text(PAGE_MARGIN, y, a.title, { size: 18, font: 'Helvetica-Bold', color: INK });
  y -= 30;
  front.text(PAGE_MARGIN, y, 'Materials needed', { size: 12, font: 'Helvetica-Bold', color: barColor });
  y -= 18;
  for (const item of a.materials_needed) { front.text(PAGE_MARGIN, y, `- ${item}`, { size: 11, font: 'Helvetica', color: INK }); y -= 16; }
  y -= 10;
  front.text(PAGE_MARGIN, y, 'Steps', { size: 12, font: 'Helvetica-Bold', color: barColor });
  y -= 18;
  a.procedure_steps.forEach((step, i) => {
    y = drawWrapped(front, `${i + 1}. ${step}`, PAGE_MARGIN, y, 11, LETTER.w - PAGE_MARGIN * 2) - 6;
  });

  const back = doc.addPage(LETTER.w, LETTER.h);
  back.rect(PAGE_MARGIN, LETTER.h - 140, LETTER.w - PAGE_MARGIN * 2, 100, { fillColor: WHITE, borderColor: barColor, borderWidth: 2 });
  back.text(PAGE_MARGIN + 14, LETTER.h - 70, 'Control of Error - self-verification key', { size: 13, font: 'Helvetica-Bold', color: barColor });
  drawWrapped(back, a.self_verification_key, PAGE_MARGIN + 14, LETTER.h - 90, 12, LETTER.w - PAGE_MARGIN * 2 - 28, 1.4);
}
