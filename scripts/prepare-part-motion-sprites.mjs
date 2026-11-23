import sharp from "sharp"
import { mkdir } from "node:fs/promises"

const source = "public/images/ui/part-icons-v1"
const output = "public/images/ui/part-motion-v1"
const size = 144
const frameCount = 24

const chainPath = [
  [11, 88], [19, 70], [46, 57], [79, 44], [110, 32], [127, 39],
  [134, 53], [125, 67], [101, 79], [70, 94], [38, 105], [20, 103],
]
const beltPath = [
  [10, 92], [16, 75], [39, 56], [73, 36], [103, 24], [123, 24],
  [131, 35], [134, 53], [128, 69], [103, 84], [66, 102], [31, 116], [13, 111],
]
const pulleys = [
  { x: 100, y: 49.5, u: [28, -7], v: [4, 26], turns: 1 },
  { x: 31.5, y: 87.5, u: [14.5, -3], v: [2, 14.5], turns: 2 },
]

const mix = (a, b, amount) => a + (b - a) * amount
const clamp = (n) => Math.min(1, Math.max(0, n))
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

function curve(points) {
  const sampleCount = 600
  const pointsAtLength = [0]
  const samples = Array.from({ length: sampleCount + 1 }, (_, i) => {
    const segment = i * points.length / sampleCount
    const index = Math.floor(segment), t = segment - index
    const [a, b, c, d] = [-1, 0, 1, 2].map((n) => points[(index + n + points.length) % points.length])
    return [0, 1].map((k) => 0.5 * (2 * b[k] + (c[k] - a[k]) * t
      + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t
      + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * t * t * t))
  })
  for (let i = 1; i < samples.length; i++) pointsAtLength[i] = pointsAtLength[i - 1] + distance(samples[i - 1], samples[i])

  const total = pointsAtLength.at(-1)
  const step = total / sampleCount
  let cursor = 0
  return Array.from({ length: sampleCount }, (_, i) => {
    const length = i * step
    while (pointsAtLength[cursor + 1] < length) cursor++
    const a = samples[cursor], b = samples[cursor + 1]
    const span = pointsAtLength[cursor + 1] - pointsAtLength[cursor]
    const t = (length - pointsAtLength[cursor]) / span
    return { x: mix(a[0], b[0], t), y: mix(a[1], b[1], t), nx: (a[1] - b[1]) / span, ny: (b[0] - a[0]) / span }
  })
}

function trackMap(alpha, track) {
  return Array.from({ length: size * size }, (_, index) => {
    if (alpha[index * 4 + 3] === 0) return null
    const x = index % size, y = Math.floor(index / size)
    let closest = 0, best = Infinity
    track.forEach((point, i) => {
      const sq = (x - point.x) ** 2 + (y - point.y) ** 2
      if (sq < best) { closest = i; best = sq }
    })
    const anchor = track[closest]
    return { closest, normal: (x - anchor.x) * anchor.nx + (y - anchor.y) * anchor.ny }
  })
}

function sample(pixels, x, y, color) {
  if (x < 0 || y < 0 || x >= size - 1 || y >= size - 1) return [color[0], color[1], color[2], 0]
  const left = Math.floor(x), top = Math.floor(y)
  const start = (top * size + left) * 4
  const offsets = [start, start + 4, start + size * 4, start + size * 4 + 4]
  const dx = x - left, dy = y - top
  const weights = [(1 - dx) * (1 - dy), dx * (1 - dy), (1 - dx) * dy, dx * dy]
  const alpha = weights.map((weight, i) => weight * pixels[offsets[i] + 3])
  const total = alpha.reduce((sum, n) => sum + n, 0)
  if (total === 0) return [color[0], color[1], color[2], 0]
  return [0, 1, 2].map((channel) =>
    alpha.reduce((sum, a, i) => sum + a * pixels[offsets[i] + channel], 0) / total).concat(total)
}

function spin(pulley, x, y, phase) {
  const { u, v } = pulley
  const determinant = u[0] * v[1] - u[1] * v[0]
  const dx = x - pulley.x, dy = y - pulley.y
  const a = (dx * v[1] - dy * v[0]) / determinant
  const b = (u[0] * dy - u[1] * dx) / determinant
  const radius = Math.hypot(a, b)
  const blend = clamp((1.06 - radius) * 14)
  if (blend === 0) return null
  const angle = Math.atan2(b, a) - phase * Math.PI * 2 * pulley.turns
  const c = Math.cos(angle) * radius, s = Math.sin(angle) * radius
  return { x: pulley.x + u[0] * c + v[0] * s, y: pulley.y + u[1] * c + v[1] * s, blend }
}

async function sprite(kind, iconNumber, outline) {
  const base = await sharp(`${source}/engine-${iconNumber}.webp`).ensureAlpha().raw().toBuffer()
  const track = curve(outline)
  const anchors = trackMap(base, track)
  const panels = await Promise.all(Array.from({ length: frameCount }, async (_, frame) => {
    const time = frame / (frameCount - 1)
    const rise = Math.sin(time * Math.PI)
    const phase = time * time * (3 - 2 * time)
    const pixels = Buffer.from(base)
    if (frame !== 0 && frame !== frameCount - 1) {
      for (let i = 0; i < anchors.length; i++) {
        const position = anchors[i]
        if (!position) continue
        const color = base.subarray(i * 4, i * 4 + 3)
        const x = i % size, y = Math.floor(i / size)
        const pulley = kind === "belt" ? pulleys.map((item) => spin(item, x, y, phase)).find(Boolean) : null
        const movement = kind === "belt" ? 24 : 38
        const point = track[(position.closest + track.length - Math.round(phase * movement)) % track.length]
        const moved = pulley
          ? sample(base, pulley.x, pulley.y, color)
          : sample(base, point.x + position.normal * point.nx, point.y + position.normal * point.ny, color)
        const amount = clamp(moved[3] / 210) * (pulley ? pulley.blend : Math.min(1, rise * 2.3) * 0.93)
        for (let channel = 0; channel < 3; channel++) pixels[i * 4 + channel] = Math.round(mix(color[channel], moved[channel], amount))
      }
    }
    const input = await sharp(pixels, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer()
    return { input, left: frame * size, top: 0 }
  }))
  await sharp({ create: { width: size * frameCount, height: size, channels: 4, background: "#0000" } })
    .composite(panels).webp({ quality: 79, alphaQuality: 100, effort: 6 }).toFile(`${output}/${kind}.webp`)
}

await mkdir(output, { recursive: true })
await sprite("belt", 7, beltPath)
await sprite("chain", 8, chainPath)
