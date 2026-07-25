import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const BG = [24, 63, 54, 255];
const FG = [244, 241, 234, 255];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function makeIcon(size) {
  const pixels = new Uint8Array(size * size * 4);
  const paint = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const offset = (Math.floor(y) * size + Math.floor(x)) * 4;
    pixels.set(color, offset);
  };
  const disc = (cx, cy, radius, color) => {
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(size - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(size - 1, Math.ceil(cy + radius));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) paint(x, y, color);
      }
    }
  };
  const line = (x1, y1, x2, y2, width, color) => {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      disc(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, color);
    }
  };

  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set(BG, offset);
  const scale = size / 512;
  const cx = 256 * scale;
  const cy = 256 * scale;
  const outer = 153 * scale;
  const inner = 131 * scale;
  disc(cx, cy, outer, FG);
  disc(cx, cy, inner, BG);
  disc(220 * scale, 218 * scale, 28 * scale, FG);
  line(308 * scale, 237 * scale, 308 * scale, 307 * scale, 22 * scale, FG);
  line(269 * scale, 268 * scale, 308 * scale, 307 * scale, 22 * scale, FG);
  line(347 * scale, 268 * scale, 308 * scale, 307 * scale, 22 * scale, FG);

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    raw.set(pixels.subarray(y * size * 4, (y + 1) * size * 4), row + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", makeIcon(192));
writeFileSync("public/icons/icon-512.png", makeIcon(512));
writeFileSync("public/icons/maskable-512.png", makeIcon(512));
