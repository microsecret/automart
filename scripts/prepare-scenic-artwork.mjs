// Server-only asset optimization, not an application build.
import sharp from "sharp"
import { mkdir } from "node:fs/promises"
import path from "node:path"
const source = process.argv[2]
if (!source) throw new Error("Source directory required")
const target = process.argv[3] || "public/images/ui/scenic-v1"
await mkdir(target, { recursive: true })
const available = ["buy", "sell", "auctions", "parts", "fuel", "garage", "deliveries", "subscriptions", "payments", "referral", "profile", "store", "messages", "part-engine", "part-brakes", "part-suspension", "part-electrical", "part-lighting"]
const selected = process.argv.slice(4)
for (const name of selected.length ? selected : available) {
  if (!available.includes(name)) throw new Error(`Unknown scenic asset: ${name}`)
  for (const width of [960, 1600]) {
    const result = await sharp(path.join(source, `${name}.png`)).resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 5 }).toFile(path.join(target, `${name}-${width}.webp`))
    console.log(`${name}-${width}.webp: ${result.size} bytes`)
  }
}
