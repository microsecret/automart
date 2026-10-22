// Server-only asset preparation. Source PNG masters are never shipped.
import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const source = process.argv[2]
if (!source) throw new Error("A source directory is required")
const output = path.resolve(process.argv[3] || "public/images/ui/category-v1")
await fs.mkdir(output, { recursive: true })
for (const name of ["cars", "parts"]) {
  const file = path.join(source, `${name}.png`)
  const metadata = await sharp(file).metadata()
  const stats = await sharp(file).stats()
  if (!metadata.hasAlpha || stats.channels[3]?.min !== 0) throw new Error(`${name}: transparent artwork is required`)
  for (const size of [320, 640]) {
    const result = await sharp(file).resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, alphaQuality: 90, effort: 5 }).toFile(path.join(output, `${name}-${size}.webp`))
    console.log(`${name}-${size}.webp ${result.width}x${result.height} ${result.size} bytes`)
  }
}
