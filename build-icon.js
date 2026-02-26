#!/usr/bin/env node
/**
 * build-icon.js — Generate BMO Avatar app icon
 * Creates build/icon.icns from a raw PNG (no external deps)
 * Uses only Node built-ins + macOS sips/iconutil
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

// ─── Minimal PNG encoder ───────────────────────────────────────────────────────
function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeB = Buffer.from(type, 'ascii');
  const lenB  = Buffer.alloc(4); lenB.writeUInt32BE(data.length, 0);
  const payload = Buffer.concat([typeB, data]);
  const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc32(payload), 0);
  return Buffer.concat([lenB, payload, crcB]);
}

function encodePNG(pixels, width, height) {
  // pixels: Uint8Array of RGBA values, row by row
  // Build raw filter-byte prepended rows
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      row[1 + x * 4 + 0] = pixels[i + 0]; // R
      row[1 + x * 4 + 1] = pixels[i + 1]; // G
      row[1 + x * 4 + 2] = pixels[i + 2]; // B
      row[1 + x * 4 + 3] = pixels[i + 3]; // A
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw, { level: 6 });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 6;  // color type: RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ─── Draw BMO face ─────────────────────────────────────────────────────────────
function drawBmo(size) {
  const pixels = new Uint8Array(size * size * 4);

  const fill = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i]     = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = a;
  };

  const fillRect = (x0, y0, w, h, r, g, b, a = 255) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++)
        fill(x, y, r, g, b, a);
  };

  const fillCircle = (cx, cy, radius, r, g, b, a = 255) => {
    for (let y = cy - radius; y <= cy + radius; y++)
      for (let x = cx - radius; x <= cx + radius; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2)
          fill(x, y, r, g, b, a);
  };

  const s = size / 512; // scale factor

  // Background: transparent
  // Body: teal rounded rect
  const margin  = Math.round(40 * s);
  const radius  = Math.round(60 * s);
  const bodyX   = margin;
  const bodyY   = margin;
  const bodyW   = size - margin * 2;
  const bodyH   = size - margin * 2;

  // Draw rounded rectangle body (teal: 0x00B4CC)
  const [bR, bG, bB] = [0, 180, 204];

  // Fill main body rect (without corners)
  fillRect(bodyX + radius, bodyY, bodyW - radius * 2, bodyH, bR, bG, bB);
  fillRect(bodyX, bodyY + radius, bodyW, bodyH - radius * 2, bR, bG, bB);

  // Round corners
  const corners = [
    [bodyX + radius, bodyY + radius],
    [bodyX + bodyW - radius, bodyY + radius],
    [bodyX + radius, bodyY + bodyH - radius],
    [bodyX + bodyW - radius, bodyY + bodyH - radius]
  ];
  for (const [cx, cy] of corners) fillCircle(cx, cy, radius, bR, bG, bB);

  // Dark border
  const borderW = Math.round(6 * s);
  // Top, bottom, left, right edges — simplified with inner-border concept:
  // Just draw darker outline 2px inside body
  // (skip for simplicity at small sizes)

  // Screen area (darker teal)
  const screenX = Math.round(bodyX + 50 * s);
  const screenY = Math.round(bodyY + 60 * s);
  const screenW = Math.round(bodyW - 100 * s);
  const screenH = Math.round(bodyH * 0.45);
  fillRect(screenX, screenY, screenW, screenH, 0, 140, 160);
  // Screen border
  fillRect(screenX - 4, screenY - 4, screenW + 8, 4, 0, 80, 100);
  fillRect(screenX - 4, screenY + screenH, screenW + 8, 4, 0, 80, 100);
  fillRect(screenX - 4, screenY - 4, 4, screenH + 8, 0, 80, 100);
  fillRect(screenX + screenW, screenY - 4, 4, screenH + 8, 0, 80, 100);

  // Eyes (white circles with dark pupils)
  const eyeY    = Math.round(bodyY + 150 * s);
  const eye1X   = Math.round(bodyX + 140 * s);
  const eye2X   = Math.round(bodyX + 310 * s);
  const eyeR    = Math.round(32 * s);
  const pupilR  = Math.round(14 * s);

  fillCircle(eye1X, eyeY, eyeR, 255, 255, 255);
  fillCircle(eye2X, eyeY, eyeR, 255, 255, 255);
  fillCircle(eye1X, eyeY, pupilR, 20, 20, 20);
  fillCircle(eye2X, eyeY, pupilR, 20, 20, 20);

  // Mouth (smile — simple rectangle)
  const mouthY = Math.round(bodyY + 280 * s);
  const mouthX = Math.round(bodyX + 160 * s);
  const mouthW = Math.round(160 * s);
  const mouthH = Math.round(20 * s);
  fillRect(mouthX, mouthY, mouthW, mouthH, 20, 20, 20);
  // Smile corners
  fillRect(mouthX - Math.round(10 * s), mouthY - Math.round(12 * s), Math.round(10 * s), Math.round(12 * s), 20, 20, 20);
  fillRect(mouthX + mouthW, mouthY - Math.round(12 * s), Math.round(10 * s), Math.round(12 * s), 20, 20, 20);

  // Cheek blush (pink circles)
  const blushR = Math.round(18 * s);
  fillCircle(Math.round(bodyX + 90 * s),  Math.round(bodyY + 240 * s), blushR, 255, 150, 150, 180);
  fillCircle(Math.round(bodyX + 390 * s), Math.round(bodyY + 240 * s), blushR, 255, 150, 150, 180);

  return pixels;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const buildDir    = path.join(__dirname, 'build');
const iconsetDir  = path.join(buildDir, 'icon.iconset');
const icnsPath    = path.join(buildDir, 'icon.icns');
const masterPath  = path.join(buildDir, 'icon.png');

fs.mkdirSync(iconsetDir, { recursive: true });

// Generate master 512×512
console.log('Drawing 512×512 BMO icon...');
const pixels512 = drawBmo(512);
const png512 = encodePNG(pixels512, 512, 512);
fs.writeFileSync(masterPath, png512);
console.log(`  ✔ build/icon.png (${png512.length} bytes)`);

// Required iconset sizes
const sizes = [16, 32, 64, 128, 256, 512];

for (const sz of sizes) {
  const name1x = `icon_${sz}x${sz}.png`;
  const name2x = `icon_${sz}x${sz}@2x.png`;
  const sz2x   = sz * 2;

  // Generate 1x
  const px1 = drawBmo(sz);
  fs.writeFileSync(path.join(iconsetDir, name1x), encodePNG(px1, sz, sz));

  // Generate 2x (use next size up or same)
  const px2 = drawBmo(Math.min(sz2x, 1024));
  const actualSz2 = Math.min(sz2x, 1024);
  fs.writeFileSync(path.join(iconsetDir, name2x), encodePNG(px2, actualSz2, actualSz2));

  console.log(`  ✔ ${name1x} + ${name2x}`);
}

// Convert to .icns using iconutil (macOS built-in)
console.log('\nRunning iconutil...');
try {
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`, { stdio: 'inherit' });
  console.log(`\n✅ build/icon.icns created successfully!`);
} catch (err) {
  console.error('iconutil failed:', err.message);
  console.log('The PNG files are in build/icon.iconset/ — you can convert manually.');
  process.exit(1);
}
