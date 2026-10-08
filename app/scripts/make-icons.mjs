// 產生 App 圖示 PNG（青綠底 + 白色帳本），不依賴外部套件
// 用法：node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [15, 157, 138]
const WHITE = [255, 255, 255]

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function pixel(x, y, s) {
  // 以 0..1 的座標描述圖形
  const u = x / s, v = y / s
  // 帳本本體（圓角矩形）
  const left = 0.26, right = 0.74, top = 0.2, bottom = 0.8, r = 0.05
  const inX = u >= left && u <= right, inY = v >= top && v <= bottom
  if (inX && inY) {
    const cx = Math.min(Math.max(u, left + r), right - r)
    const cy = Math.min(Math.max(v, top + r), bottom - r)
    if ((u - cx) ** 2 + (v - cy) ** 2 > r * r) return BG
    // 帳本上的橫線
    for (const ly of [0.36, 0.48, 0.6]) {
      if (v >= ly && v <= ly + 0.035 && u >= 0.34 && u <= 0.66) return BG
    }
    return WHITE
  }
  return BG
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x + 0.5, y + 0.5, size)
      raw[o++] = r; raw[o++] = g; raw[o++] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const out = new URL('../public/', import.meta.url)
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(new URL(name, out), png(size))
}
console.log('icons written')
