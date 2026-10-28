// Server-only preparation with the existing sharp package; no source masters ship.
import sharp from "sharp"
import { mkdir } from "node:fs/promises"
import path from "node:path"
const source = process.argv[2]
if (!source) throw new Error("Source directory required")
const target = "public/images/ui/body-v1"
await mkdir(target, { recursive: true })
for (const name of ["sedan", "hatchback", "suv", "wagon", "coupe", "pickup", "minivan"]) {
  const input = sharp(path.join(source, `${name}.png`))
  const metadata = await input.metadata()
  const stats = await input.stats()
  if (!metadata.hasAlpha || stats.channels.at(-1).min !== 0) throw new Error(`Transparent master required: ${name}`)
  // Remove only transparent outer padding; contain preserves the entire body.
  const trimmed = await input.trim().toBuffer()
  for (const width of [120, 240]) {
    const margin = width / 15
    const height = width * .6
    const result = await sharp(trimmed).resize({ width: width - margin * 2, height: height - margin * 2, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({ top: margin, bottom: margin, left: margin, right: margin, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 84, alphaQuality: 90, effort: 5 }).toFile(path.join(target, `${name}-${width}.webp`))
    console.log(`${name}-${width}: ${result.width}x${result.height} ${result.size} bytes`)
  }
}
