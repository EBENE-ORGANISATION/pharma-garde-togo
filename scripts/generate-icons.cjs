// Generates the PWA app icons (green/white pharmacy cross) as plain PNGs,
// with no external dependencies. Re-run after changing size/colors:
//   node scripts/generate-icons.cjs
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BG = [0x2f, 0x73, 0x55]; // theme green
const FG = [0xff, 0xff, 0xff]; // white cross

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function generateIcon(size, outPath) {
  const barThickness = Math.round(size * 0.22);
  const margin = Math.round(size * 0.18);
  const cx = size / 2;
  const cy = size / 2;

  const stride = size * 3 + 1; // RGB + filter byte per row
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    const offset = y * stride;
    raw[offset] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inVBar = Math.abs(x - cx) < barThickness / 2 && y >= margin && y <= size - margin;
      const inHBar = Math.abs(y - cy) < barThickness / 2 && x >= margin && x <= size - margin;
      const color = inVBar || inHBar ? FG : BG;
      const p = offset + 1 + x * 3;
      raw[p] = color[0];
      raw[p + 1] = color[1];
      raw[p + 2] = color[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${png.length} bytes)`);
}

generateIcon(192, path.join(__dirname, "..", "public", "icons", "icon-192.png"));
generateIcon(512, path.join(__dirname, "..", "public", "icons", "icon-512.png"));
