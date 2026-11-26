import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, crc32 } from 'node:zlib';
import { PdfDocument, parseJpegDimensions, parsePngInfo, canEmbedImage, hexColor, rgb } from '../src/lib/pdf/pdf-writer.ts';

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

// A real, correct PNG built with Node's own zlib — no npm dependency, no decoding assumptions.
function buildPng(width: number, height: number, color: [number, number, number]): Uint8Array {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor RGB
  const stride = 1 + width * 3;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter type: None
    for (let x = 0; x < width; x++) {
      const o = y * stride + 1 + x * 3;
      raw[o] = color[0]; raw[o + 1] = color[1]; raw[o + 2] = color[2];
    }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('parsePngInfo reads width/height/color type from a real PNG', () => {
  const info = parsePngInfo(buildPng(64, 48, [200, 16, 46]));
  assert.equal(info.width, 64);
  assert.equal(info.height, 48);
  assert.equal(info.colorType, 2);
  assert.ok(info.idat.length > 0);
});

test('canEmbedImage accepts valid JPEG and PNG, rejects garbage', () => {
  assert.equal(canEmbedImage(fakeJpeg(10, 10)), true);
  assert.equal(canEmbedImage(buildPng(10, 10, [0, 0, 0])), true);
  assert.equal(canEmbedImage(new Uint8Array([1, 2, 3])), false);
});

test('a PNG embeds as FlateDecode with the PNG Predictor, byte-exact xref', () => {
  const doc = new PdfDocument();
  const page = doc.addPage(200, 200);
  page.image(10, 10, 100, 80, buildPng(64, 48, [200, 16, 46]));
  const bytes = doc.save();
  const text = Buffer.from(bytes).toString('latin1');

  const xrefOffset = Number(text.match(/startxref\n(\d+)\n%%EOF/)![1]);
  const header = text.slice(xrefOffset).match(/^xref\n0 (\d+)\n/)!;
  const total = Number(header[1]);
  const entries = text.slice(xrefOffset + header[0].length, xrefOffset + header[0].length + total * 20).match(/.{20}/gs) ?? [];
  for (let n = 1; n < total; n++) {
    const offset = Number(entries[n].match(/^(\d{10}) 00000 n \n$/)![1]);
    assert.equal(text.slice(offset, offset + `${n} 0 obj`.length), `${n} 0 obj`);
  }

  assert.match(text, /\/Width 64 \/Height 48 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/FlateDecode \/DecodeParms << \/Predictor 15 \/Colors 3 \/BitsPerComponent 8 \/Columns 64 >>/);
});
