// Server-only asset optimization, not an application build.
import sharp from "sharp"
import { mkdir } from "node:fs/promises"
import path from "node:path"
const source = process.argv[2]
if (!source) throw new Error("Source directory required")
const target = process.argv[3] || "public/images/ui/scenic-v1"
await mkdir(target, { recursive: true })
for (const name of ["buy", "sell", "auctions", "parts", "fuel", "garage", "deliveries", "subscriptions", "payments", "referral"]) {
  for (const width of [960, 1600]) {
    const result = await sharp(path.join(source, `${name}.png`)).resize({ width, withoutEnlargement: true }).webp({ quality: 82, effort: 5 }).toFile(path.join(target, `${name}-${width}.webp`))
    console.log(`${name}-${width}.webp: ${result.size} bytes`)
  }
}
