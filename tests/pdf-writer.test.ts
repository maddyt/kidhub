import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PdfDocument, parseJpegDimensions, hexColor, rgb } from '../src/lib/pdf/pdf-writer.ts';

// A synthetic but structurally valid JPEG header: SOI, then an SOF0 segment declaring
// 320x240, 3 components (DeviceRGB), then EOI. No real entropy-coded image data — this only
// needs to satisfy parseJpegDimensions' marker scan, not an actual JPEG decoder.
function fakeJpeg(width: number, height: number, components: 1 | 3 = 3): Uint8Array {
  const comps: number[] = [];
  for (let i = 0; i < components; i++) comps.push(i + 1, 0x11, 0); // id, sampling, quant table
  const length = 2 + 1 + 2 + 2 + 1 + comps.length;
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xc0, (length >> 8) & 0xff, length & 0xff, // SOF0, length
    0x08, (height >> 8) & 0xff, height & 0xff, (width >> 8) & 0xff, width & 0xff, components,
    ...comps,
    0xff, 0xd9, // EOI
  ]);
}

test('parseJpegDimensions reads width/height/components from the SOF marker', () => {
  const info = parseJpegDimensions(fakeJpeg(320, 240, 3));
  assert.deepEqual(info, { width: 320, height: 240, components: 3 });
});

test('parseJpegDimensions handles grayscale (1-component) JPEGs', () => {
  const info = parseJpegDimensions(fakeJpeg(64, 48, 1));
  assert.equal(info.components, 1);
});

test('parseJpegDimensions rejects non-JPEG data', () => {
  assert.throws(() => parseJpegDimensions(new Uint8Array([0, 1, 2, 3])));
});

test('a document with an embedded image produces byte-exact xref offsets and a correct image XObject', () => {
  const doc = new PdfDocument();
  const page = doc.addPage(200, 200);
  page.rect(10, 10, 50, 50, { borderColor: hexColor('#C8102E'), borderWidth: 2 });
  page.image(20, 20, 100, 80, fakeJpeg(100, 80, 3));
  page.text(10, 150, 'Caption', { size: 12, font: 'Helvetica', color: rgb(0, 0, 0) });

  const bytes = doc.save();
  const text = Buffer.from(bytes).toString('latin1');

  assert.ok(text.startsWith('%PDF-1.4\n'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));

  const xrefMatch = text.match(/startxref\n(\d+)\n%%EOF/);
  assert.ok(xrefMatch);
  const xrefOffset = Number(xrefMatch![1]);
  assert.equal(text.slice(xrefOffset, xrefOffset + 4), 'xref');

  const header = text.slice(xrefOffset).match(/^xref\n0 (\d+)\n/);
  assert.ok(header);
  const total = Number(header![1]);
  const entries = text.slice(xrefOffset + header![0].length, xrefOffset + header![0].length + total * 20).match(/.{20}/gs) ?? [];
  assert.equal(entries.length, total);
  for (let n = 1; n < total; n++) {
    const offset = Number(entries[n].match(/^(\d{10}) 00000 n \n$/)![1]);
    assert.equal(text.slice(offset, offset + `${n} 0 obj`.length), `${n} 0 obj`);
  }

  assert.match(text, /\/Subtype \/Image \/Width 100 \/Height 80 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode/);
  assert.match(text, /\/XObject << \/Im0 \d+ 0 R >>/);
  assert.match(text, /\/Im0 Do/);
});
