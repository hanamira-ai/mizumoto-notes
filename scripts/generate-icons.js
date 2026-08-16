import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal PNG generator in pure Node without external dependencies
function createSolidPng(width, height, r, g, b, a = 255) {
  // Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type (RGBA)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);

  // Raw image data with filter byte per row
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  // Simple rendering of crimson background with centered letter M
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      
      // Default: Crimson #A3242A (163, 36, 42)
      let pr = 163;
      let pg = 36;
      let pb = 42;
      let pa = 255;

      // Normalize coords to 0..1
      const nx = x / width;
      const ny = y / height;

      // Draw stylized 'M'
      const inM = (
        (nx >= 0.25 && nx <= 0.35 && ny >= 0.25 && ny <= 0.75) || // Left leg
        (nx >= 0.65 && nx <= 0.75 && ny >= 0.25 && ny <= 0.75) || // Right leg
        (Math.abs((ny - 0.25) - (nx - 0.25) * 1.5) < 0.08 && nx >= 0.25 && nx <= 0.5 && ny >= 0.25 && ny <= 0.65) || // Left diagonal
        (Math.abs((ny - 0.25) - (0.75 - nx) * 1.5) < 0.08 && nx >= 0.5 && nx <= 0.75 && ny >= 0.25 && ny <= 0.65)    // Right diagonal
      );

      if (inM) {
        pr = 255;
        pg = 255;
        pb = 255;
      }

      rawData[pixelOffset] = pr;
      rawData[pixelOffset + 1] = pg;
      rawData[pixelOffset + 2] = pb;
      rawData[pixelOffset + 3] = pa;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const iconsDir = path.resolve('public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), createSolidPng(192, 192, 163, 36, 42));
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), createSolidPng(512, 512, 163, 36, 42));
fs.writeFileSync(path.join(iconsDir, 'icon-512x512-maskable.png'), createSolidPng(512, 512, 163, 36, 42));

console.log('PWA PNG icons generated successfully in public/icons/');
