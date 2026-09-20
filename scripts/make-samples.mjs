/**
 * Generates committed sample photographs for the demo seeding script.
 *
 *   node scripts/make-samples.mjs
 *
 * Writes abstract water-study PNGs into public/samples/. They are generated,
 * so there are no rights to clear — and they are labelled as samples, not
 * presented as field photographs. Each city gets its own hue; every image is
 * a 640x480 RGB gradient with banding and noise, enough for a real vision
 * call to describe colour, clarity, and surface honestly.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const WIDTH = 640;
const HEIGHT = 480;

const CITIES = [
  { slug: "coimbra", hue: [46, 92, 86] },
  { slug: "ghent", hue: [58, 96, 88] },
  { slug: "oslo", hue: [52, 84, 96] },
  { slug: "toulouse", hue: [70, 100, 80] },
  { slug: "benevento", hue: [60, 88, 70] },
];

/** CRC-32 (ISO 3309), for PNG chunk checksums. */
function crc32(bytes) {
  let table = crc32.table;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

/** Deterministic pseudo-random from coordinates — stable across runs. */
function noise(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 974711) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = (h * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function samplePng([rBase, gBase, bBase], seed) {
  const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
  let offset = 0;
  for (let y = 0; y < HEIGHT; y += 1) {
    raw[offset] = 0; // No filter.
    offset += 1;
    const depth = y / HEIGHT;
    for (let x = 0; x < WIDTH; x += 1) {
      const band = Math.sin((x / WIDTH) * 12 + seed) * 8;
      const n = (noise(x, y, seed) - 0.5) * 36;
      // Sky-lit top third, deeper water below, bright band at the interface.
      const light = depth < 0.33 ? 46 - depth * 60 : -14 - depth * 40;
      const glint = Math.exp(-Math.pow((depth - 0.33) * 22, 2)) * 52;
      const r = Math.max(0, Math.min(255, rBase + light + glint * 0.7 + band + n));
      const g = Math.max(0, Math.min(255, gBase + light + glint + band + n));
      const b = Math.max(0, Math.min(255, bBase + light + glint * 0.9 - band + n));
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      offset += 3;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // Bit depth.
  ihdr[9] = 2; // Truecolor RGB.

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/samples", { recursive: true });
for (const [index, city] of CITIES.entries()) {
  const path = `public/samples/${city.slug}.png`;
  writeFileSync(path, samplePng(city.hue, index + 1));
  console.log(`wrote ${path}`);
}
