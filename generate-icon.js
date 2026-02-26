#!/usr/bin/env node
/**
 * Generates a simple 16x16 and 32x32 tray icon PNG for JoeMac Avatar.
 * Run once: node generate-icon.js
 * Uses raw PNG chunks, no extra dependencies.
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

function writePNG(filePath, width, height, getColor) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const typeB = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeB, data]);
    let crc = 0xffffffff;
    const table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    for (let i = 0; i < crcData.length; i++) {
      crc = table[(crc ^ crcData[i]) & 0xff] ^ (crc >>> 8);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const len = Buffer.alloc(4);  len.writeUInt32BE(data.length);
    const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc);
    return Buffer.concat([len, typeB, data, crcB]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 2;  // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // IDAT — raw scanlines
  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getColor(x, y, width, height);
      raw.push(r, g, b);
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(raw));

  const iend = Buffer.alloc(0);

  const out = Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', iend)
  ]);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, out);
  console.log(`Written: ${filePath}`);
}

// BMO-style teal square with a white dot "face"
function bmoColor(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const margin = Math.floor(w * 0.08);
  const inner  = Math.floor(w * 0.18);

  // Background transparent-ish (we use teal since PNG here is RGB)
  // Outer border
  if (x < margin || x >= w - margin || y < margin || y >= h - margin) {
    return [26, 188, 156]; // teal border
  }
  // Inner body
  if (x < w - margin - 1 && y < h - margin - 1) {
    // Eyes (small white dots)
    const lex = Math.floor(w * 0.35), ley = Math.floor(h * 0.38);
    const rex = Math.floor(w * 0.62), rey = Math.floor(h * 0.38);
    const eyeR = Math.max(1, Math.floor(w * 0.08));
    if (Math.abs(x - lex) <= eyeR && Math.abs(y - ley) <= eyeR) return [255, 255, 255];
    if (Math.abs(x - rex) <= eyeR && Math.abs(y - rey) <= eyeR) return [255, 255, 255];

    // Mouth line
    const mouthY = Math.floor(h * 0.62);
    const mouthX1 = Math.floor(w * 0.32), mouthX2 = Math.floor(w * 0.68);
    if (y === mouthY && x >= mouthX1 && x <= mouthX2) return [255, 255, 255];

    return [72, 201, 176]; // teal body
  }
  return [26, 188, 156];
}

writePNG(path.join(__dirname, 'renderer', 'tray-icon.png'), 16, 16, bmoColor);
writePNG(path.join(__dirname, 'renderer', 'tray-icon@2x.png'), 32, 32, bmoColor);

console.log('Tray icons generated.');
