import 'server-only';

// A minimal PDF 1.4 writer: just enough vector graphics (lines, rectangles) and base-14
// Helvetica/Helvetica-Bold text to lay out print-ready pages, with no npm dependency.
// Deliberately small: no embedded fonts, no images, no compression. If this ever needs more
// (embedded illustrations, real font metrics, bigger documents), reach for a real PDF library
// instead of growing this file — see docs/PACKET-GENERATOR.md "What ships today."

export type RGB = { r: number; g: number; b: number }; // each 0–1
export const rgb = (r: number, g: number, b: number): RGB => ({ r, g, b });
export function hexColor(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export type FontName = 'Helvetica' | 'Helvetica-Bold';

// Adobe Core 14 AFM widths (1/1000 em) for ASCII 32–126. Good enough for layout decisions;
// this is not a typesetting-grade renderer.
const HELVETICA: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELVETICA_BOLD: number[] = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Strips characters the base-14 WinAnsi fonts can't render, with common punctuation substituted. */
export function sanitizeText(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E]/g, '?');
}

export function textWidth(font: FontName, text: string, size: number): number {
  const table = font === 'Helvetica-Bold' ? HELVETICA_BOLD : HELVETICA;
  let units = 0;
  for (const ch of sanitizeText(text)) {
    const code = ch.codePointAt(0) ?? 32;
    units += code >= 32 && code <= 126 ? table[code - 32] : table[0];
  }
  return (units / 1000) * size;
}

/** Greedy word-wrap of `text` to fit `maxWidth` at `size`. */
export function wrapText(font: FontName, text: string, size: number, maxWidth: number): string[] {
  const words = sanitizeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(font, candidate, size) > maxWidth) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function escapeString(s: string): string {
  return sanitizeText(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

class Page {
  ops: string[] = [];
  width: number;
  height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  text(x: number, y: number, str: string, opts: { size: number; font: FontName; color: RGB }) {
    const f = opts.font === 'Helvetica-Bold' ? 'F2' : 'F1';
    this.ops.push(`${opts.color.r.toFixed(3)} ${opts.color.g.toFixed(3)} ${opts.color.b.toFixed(3)} rg`);
    this.ops.push(`BT /${f} ${opts.size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapeString(str)}) Tj ET`);
  }

  line(x1: number, y1: number, x2: number, y2: number, opts: { width: number; color: RGB }) {
    this.ops.push(`${opts.color.r.toFixed(3)} ${opts.color.g.toFixed(3)} ${opts.color.b.toFixed(3)} RG`);
    this.ops.push(`${opts.width.toFixed(2)} w`);
    this.ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  rect(x: number, y: number, w: number, h: number, opts: { borderColor?: RGB; borderWidth?: number; fillColor?: RGB }) {
    if (opts.fillColor) this.ops.push(`${opts.fillColor.r.toFixed(3)} ${opts.fillColor.g.toFixed(3)} ${opts.fillColor.b.toFixed(3)} rg`);
    if (opts.borderColor) {
      this.ops.push(`${opts.borderColor.r.toFixed(3)} ${opts.borderColor.g.toFixed(3)} ${opts.borderColor.b.toFixed(3)} RG`);
      this.ops.push(`${(opts.borderWidth ?? 1).toFixed(2)} w`);
    }
    this.ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re`);
    this.ops.push(opts.fillColor && opts.borderColor ? 'B' : opts.fillColor ? 'f' : 'S');
  }
}

export class PdfDocument {
  private pages: Page[] = [];

  addPage(width: number, height: number): Page {
    const page = new Page(width, height);
    this.pages.push(page);
    return page;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  /** Serializes the whole document. Object numbers: 1=Catalog, 2=Pages, 3=F1, 4=F2, 5+=page/content pairs. */
  save(): Uint8Array {
    const chunks: Buffer[] = [];
    const offsets: number[] = [0]; // object 0 is the free-list head; real offsets fill in from index 1
    let length = 0;
    const push = (s: string) => { const b = Buffer.from(s, 'latin1'); chunks.push(b); length += b.length; };
    const beginObject = (n: number) => { offsets[n] = length; push(`${n} 0 obj\n`); };

    push('%PDF-1.4\n');

    const pageObjNums = this.pages.map((_, i) => 5 + i * 2);
    const contentObjNums = this.pages.map((_, i) => 6 + i * 2);

    beginObject(1);
    push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    beginObject(2);
    push(`<< /Type /Pages /Kids [ ${pageObjNums.map((n) => `${n} 0 R`).join(' ')} ] /Count ${this.pages.length} >>\nendobj\n`);

    beginObject(3);
    push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

    beginObject(4);
    push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');

    this.pages.forEach((page, i) => {
      const pageNum = pageObjNums[i], contentNum = contentObjNums[i];
      beginObject(pageNum);
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width.toFixed(2)} ${page.height.toFixed(2)}] ` +
           `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`);

      const stream = page.ops.join('\n');
      beginObject(contentNum);
      push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream\nendobj\n`);
    });

    const totalObjects = 4 + this.pages.length * 2 + 1;
    const xrefOffset = length;
    push('xref\n');
    push(`0 ${totalObjects}\n`);
    push('0000000000 65535 f \n');
    for (let n = 1; n < totalObjects; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
    push('trailer\n');
    push(`<< /Size ${totalObjects} /Root 1 0 R >>\n`);
    push(`startxref\n${xrefOffset}\n%%EOF`);

    return new Uint8Array(Buffer.concat(chunks));
  }
}

export type { Page as PdfPage };
