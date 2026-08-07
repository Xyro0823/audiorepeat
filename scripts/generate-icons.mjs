// Generates public/icons/*.png (192, 512, maskable 512) with no dependencies.
// Run: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

// ---------- minimal PNG encoder (RGBA) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- artwork ----------
const CYAN = [0x22, 0xe4, 0xff];

function mix(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function distToTri(px, py, t) {
  return Math.min(
    distToSeg(px, py, t[0], t[1], t[2], t[3]),
    distToSeg(px, py, t[2], t[3], t[4], t[5]),
    distToSeg(px, py, t[4], t[5], t[0], t[1]),
  );
}

function inTri(px, py, t) {
  const s1 = (t[2] - t[0]) * (py - t[1]) - (t[3] - t[1]) * (px - t[0]);
  const s2 = (t[4] - t[2]) * (py - t[3]) - (t[5] - t[3]) * (px - t[2]);
  const s3 = (t[0] - t[4]) * (py - t[5]) - (t[1] - t[5]) * (px - t[4]);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
}

function render(size, radius) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const triSize = size * 0.21;
  const tri = [
    cx - triSize * 0.8, cy - triSize,
    cx + triSize * 1.2, cy,
    cx - triSize * 0.8, cy + triSize,
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      // rounded-rect coverage
      const rx = Math.max(Math.abs(px - cx) - (cx - radius), 0);
      const ry = Math.max(Math.abs(py - cy) - (cy - radius), 0);
      const cover = Math.max(0, Math.min(1, 1.5 - Math.hypot(rx, ry)));
      if (cover <= 0) {
        rgba[i + 3] = 0;
        continue;
      }

      // background gradient (deep navy → black)
      const bg = mix([0x12, 0x16, 0x30], [0x05, 0x05, 0x0c], py / size);

      // neon triangle + glow falloff
      const d = distToTri(px, py, tri);
      const glow = inTri(px, py, tri) ? 1 : Math.max(0, 1 - d / (size * 0.3)) * 0.45;
      let color = glow > 0 ? mix(bg, CYAN, glow) : bg;

      // subtle ring
      const ring = Math.abs(Math.hypot(px - cx, py - cy) - size * 0.36);
      if (ring < 1.8) color = mix(color, CYAN, 0.4);

      rgba[i] = color[0];
      rgba[i + 1] = color[1];
      rgba[i + 2] = color[2];
      rgba[i + 3] = Math.round(255 * Math.min(1, cover));
    }
  }
  return rgba;
}

writeFileSync(join(outDir, "icon-192.png"), encodePng(192, 192, render(192, 42)));
writeFileSync(join(outDir, "icon-512.png"), encodePng(512, 512, render(512, 112)));
writeFileSync(join(outDir, "icon-maskable.png"), encodePng(512, 512, render(512, 0)));
console.log("✓ icons written to public/icons/");
