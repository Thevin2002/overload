// Generates the PWA PNG icons with no dependencies (tiny rasteriser + zlib PNG encoder).
// Run: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(out, { recursive: true })

const BG = [0x1f, 0xa2, 0x8b]
const FG = [0xff, 0xff, 0xff]
// Barbell strokes in a 64×64 design space (same as src/components/Logo.tsx)
const SEGMENTS = [
  [14, 26, 14, 38],
  [20, 21, 20, 43],
  [44, 21, 44, 43],
  [50, 26, 50, 38],
  [20, 32, 44, 32],
]
const STROKE = 5

function distToSeg(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1
  const dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function roundRectCoverage(x, y, size, r) {
  // signed distance to a rounded square [0,size]
  const cx = Math.min(Math.max(x, r), size - r)
  const cy = Math.min(Math.max(y, r), size - r)
  const d = Math.hypot(x - cx, y - cy) - r
  return Math.max(0, Math.min(1, 0.5 - d))
}

function render(size, { maskable = false, transparentCorners = true } = {}) {
  const px = new Uint8Array(size * size * 4)
  // maskable icons keep artwork inside the central 80% safe zone
  const artScale = maskable ? 0.62 : 1
  const scale = (size / 64) * artScale
  const offset = (size - 64 * scale) / 2
  const radius = maskable || !transparentCorners ? 0 : size * 0.22
  const SS = 4 // supersampling
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let fg = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const ux = (x + (sx + 0.5) / SS - offset) / scale
          const uy = (y + (sy + 0.5) / SS - offset) / scale
          if (SEGMENTS.some((s) => distToSeg(ux, uy, s) <= STROKE / 2)) fg++
        }
      const a = fg / (SS * SS)
      const bgA = radius ? roundRectCoverage(x + 0.5, y + 0.5, size, radius) : 1
      const i = (y * size + x) * 4
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(BG[c] * (1 - a) + FG[c] * a)
      px[i + 3] = Math.round(255 * bgA)
    }
  }
  return encodePNG(size, size, px)
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

writeFileSync(join(out, 'pwa-192.png'), render(192))
writeFileSync(join(out, 'pwa-512.png'), render(512))
writeFileSync(join(out, 'pwa-maskable-512.png'), render(512, { maskable: true }))
writeFileSync(join(out, 'apple-touch-icon.png'), render(180, { transparentCorners: false }))
writeFileSync(
  join(out, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#1fa28b"/><path d="M14 26v12M20 21v22M44 21v22M50 26v12M20 32h24" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"/></svg>\n`,
)
console.log('Icons written to', out)
