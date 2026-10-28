// Run on the server with the existing sharp installation.
import sharp from "sharp"
import { mkdir } from "node:fs/promises"
import path from "node:path"
const source = process.argv[2]
if (!source) throw new Error("Source directory required")
const target = "public/images/ui/product-v1"
await mkdir(target, { recursive: true })
const original = ["filter", "sparkplug", "belt", "oil"]
const available = [...original, "tools", "care", "wiper", "dashcam", "mats", "seat-cover", "compressor", "jack", "safety", "roof-rack", "charger"]
const selected = process.argv.slice(3)
available.push("telegram-assistant")
for (const name of selected.length ? selected : original) {
  if (!available.includes(name)) throw new Error(`Unknown product asset: ${name}`)
  const input = sharp(path.join(source, `${name}.png`))
  const metadata = await input.metadata()
  const stats = await input.stats()
  if (!metadata.hasAlpha || stats.channels.at(-1).min !== 0) throw new Error(`Transparent master required: ${name}`)
  for (const width of [96, 192]) {
    const result = await input.clone().resize({ width, height: width, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 86, effort: 5 }).toFile(path.join(target, `${name}-${width}.webp`))
    console.log(`${name}-${width}: ${result.size} bytes`)
  }
}
