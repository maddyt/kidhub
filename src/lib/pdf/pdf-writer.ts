// A minimal PDF 1.4 writer: vector graphics (lines, rectangles), base-14 Helvetica/Helvetica-Bold
// text, and JPEG/PNG image embedding — just enough to lay out print-ready pages, with no npm
// dependency. Deliberately small: no embedded (non-base-14) fonts, no compression of its own
// text/vector content. If this ever needs more, reach for a real PDF library instead of growing
// this file — see docs/PACKET-GENERATOR.md "What ships today."
//
// No 'server-only' guard here on purpose, unlike its callers (packet-compiler.ts, etc.): this
// module touches no secrets or env vars — it's pure Buffer/string manipulation — and the guard
// package itself throws when imported outside Next's build pipeline, which would make
// tests/pdf-writer.test.ts unrunnable even with real node_modules in CI.

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

export interface JpegInfo { width: number; height: number; components: 1 | 3 | 4 }

/**
 * Reads width/height/component-count from a baseline or progressive JPEG's SOF marker, by
 * scanning the marker segments (no decoding of the actual image data). Needed because a PDF
 * Image XObject must declare its pixel dimensions and color space up front.
 */
export function parseJpegDimensions(data: Uint8Array): JpegInfo {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) throw new Error('Not a JPEG (missing SOI marker).');
  let i = 2;
  while (i < data.length - 1) {
    if (data[i] !== 0xff) { i++; continue; }
    const marker = data[i + 1];
    // SOF0–SOF3, SOF5–SOF7, SOF9–SOF11, SOF13–SOF15 all share this field layout; SOI/EOI/RST/TEM have no length.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const length = (data[i + 2] << 8) | data[i + 3];
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = (data[i + 5] << 8) | data[i + 6];
      const width = (data[i + 7] << 8) | data[i + 8];
      const components = data[i + 9];
      if (components !== 1 && components !== 3 && components !== 4) throw new Error(`Unsupported JPEG component count: ${components}`);
      return { width, height, components: components as 1 | 3 | 4 };
    }
    i += 2 + length;
  }
  throw new Error('No SOF marker found — not a readable JPEG.');
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function isPng(data: Uint8Array): boolean {
  return data.length >= 8 && PNG_SIGNATURE.every((b, i) => data[i] === b);
}
function isJpeg(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === 0xff && data[1] === 0xd8;
}

export interface PngInfo { width: number; height: number; colorType: 0 | 2; idat: Uint8Array }

function readUint32BE(data: Uint8Array, offset: number): number {
  return ((data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
}

/**
 * Reads IHDR (width/height/bit depth/color type) and concatenates the IDAT chunks of a PNG.
 * Only 8-bit, non-interlaced grayscale or RGB (no alpha, no palette) is supported — covers a
 * plain white-background illustration, which is all this needs; anything else throws so the
 * caller can fall back rather than embed something wrong.
 *
 * The IDAT bytes are returned *as-is* (still zlib-deflated, still PNG-filtered per scanline) —
 * PDF's `/Filter /FlateDecode` with a PNG `/Predictor` (10–15) is exactly PNG's own IDAT layout,
 * so a PDF reader undoes both the compression and the per-row filtering itself. No decoding here.
 */
export function parsePngInfo(data: Uint8Array): PngInfo {
  if (!isPng(data)) throw new Error('Not a PNG (bad signature).');
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = -1, interlace = 0;
  const idatChunks: Uint8Array[] = [];
  while (offset + 8 <= data.length) {
    const length = readUint32BE(data, offset);
    const type = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
    const chunkStart = offset + 8;
    if (type === 'IHDR') {
      width = readUint32BE(data, chunkStart);
      height = readUint32BE(data, chunkStart + 4);
      bitDepth = data[chunkStart + 8];
      colorType = data[chunkStart + 9];
      interlace = data[chunkStart + 12];
    } else if (type === 'IDAT') {
      idatChunks.push(data.subarray(chunkStart, chunkStart + length));
    } else if (type === 'IEND') {
      break;
    }
    offset = chunkStart + length + 4; // + 4 for the CRC we don't need
  }
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth} (only 8-bit is supported).`);
  if (colorType !== 0 && colorType !== 2) throw new Error(`Unsupported PNG color type: ${colorType} (only grayscale/RGB without alpha).`);
  if (interlace !== 0) throw new Error('Interlaced PNGs are not supported.');
  if (!idatChunks.length) throw new Error('PNG has no IDAT data.');
  const idat = idatChunks.length === 1 ? idatChunks[0] : concatBytes(idatChunks);
  return { width, height, colorType: colorType as 0 | 2, idat };
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

/** Whether `image()` can embed these bytes — checks the format is readable, not that it decodes correctly. */
export function canEmbedImage(data: Uint8Array): boolean {
  try {
    if (isJpeg(data)) { parseJpegDimensions(data); return true; }
    if (isPng(data)) { parsePngInfo(data); return true; }
    return false;
  } catch {
    return false;
  }
}

type PageImage =
  | { name: string; format: 'jpeg'; data: Uint8Array; width: number; height: number; components: 1 | 3 | 4 }
  | { name: string; format: 'png'; data: Uint8Array; width: number; height: number; components: 1 | 3 };

class Page {
  ops: string[] = [];
  images: PageImage[] = [];
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

  /** Draws a JPEG or PNG (8-bit, non-interlaced, no alpha) scaled into (x, y, w, h), PDF points, origin bottom-left. */
  image(x: number, y: number, w: number, h: number, imageBytes: Uint8Array) {
    const name = `Im${this.images.length}`;
    if (isJpeg(imageBytes)) {
      const info = parseJpegDimensions(imageBytes);
      this.images.push({ name, format: 'jpeg', data: imageBytes, width: info.width, height: info.height, components: info.components });
    } else if (isPng(imageBytes)) {
      const info = parsePngInfo(imageBytes);
      this.images.push({ name, format: 'png', data: info.idat, width: info.width, height: info.height, components: info.colorType === 0 ? 1 : 3 });
    } else {
      throw new Error('Unsupported image format — expected JPEG or PNG.');
    }
    this.ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${name} Do Q`);
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

  /**
   * Serializes the whole document. Object numbers: 1=Catalog, 2=Pages, 3=F1, 4=F2, then for each
   * page in order: one object per embedded image, one Page object, one Contents stream object.
   */
  save(): Uint8Array {
    const chunks: Buffer[] = [];
    const offsets: number[] = [0]; // object 0 is the free-list head; real offsets fill in from index 1
    let length = 0;
    const push = (s: string) => { const b = Buffer.from(s, 'latin1'); chunks.push(b); length += b.length; };
    const pushBytes = (b: Uint8Array) => { chunks.push(Buffer.from(b)); length += b.length; };
    const beginObject = (n: number) => { offsets[n] = length; push(`${n} 0 obj\n`); };

    push('%PDF-1.4\n');

    // Pass 1: assign every object a number, in the order it will be written.
    let next = 5;
    const pageObjNum: number[] = [];
    const contentObjNum: number[] = [];
    const imageObjNums: number[][] = this.pages.map(() => []);
    this.pages.forEach((page, i) => {
      imageObjNums[i] = page.images.map(() => next++);
      pageObjNum.push(next++);
      contentObjNum.push(next++);
    });
    const totalObjects = next;

    beginObject(1);
    push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    beginObject(2);
    push(`<< /Type /Pages /Kids [ ${pageObjNum.map((n) => `${n} 0 R`).join(' ')} ] /Count ${this.pages.length} >>\nendobj\n`);

    beginObject(3);
    push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

    beginObject(4);
    push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n');

    this.pages.forEach((page, i) => {
      page.images.forEach((img, j) => {
        beginObject(imageObjNums[i][j]);
        const colorSpace = img.components === 1 ? 'DeviceGray' : img.components === 4 ? 'DeviceCMYK' : 'DeviceRGB';
        const filter = img.format === 'jpeg'
          ? '/Filter /DCTDecode'
          : `/Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors ${img.components} /BitsPerComponent 8 /Columns ${img.width} >>`;
        push(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} ` +
             `/ColorSpace /${colorSpace} /BitsPerComponent 8 ${filter} /Length ${img.data.length} >>\nstream\n`);
        pushBytes(img.data);
        push('\nendstream\nendobj\n');
      });

      const xobjectDict = page.images.map((img, j) => `/${img.name} ${imageObjNums[i][j]} 0 R`).join(' ');
      beginObject(pageObjNum[i]);
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width.toFixed(2)} ${page.height.toFixed(2)}] ` +
           `/Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobjectDict ? ` /XObject << ${xobjectDict} >>` : ''} >> ` +
           `/Contents ${contentObjNum[i]} 0 R >>\nendobj\n`);

      const stream = page.ops.join('\n');
      beginObject(contentObjNum[i]);
      push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream\nendobj\n`);
    });

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
