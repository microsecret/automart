// Server-only optimization of original transparent navigation masters.
import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const source = process.argv[2]
if (!source) throw new Error("Source directory required")
const target = "public/images/ui/navigation-v1"
await fs.mkdir(target, { recursive: true })
for (const name of ["dashboard", "wallet", "settings", "bell", "orders", "store", "support"]) {
  const file = path.join(source, `${name}.png`)
  const metadata = await sharp(file).metadata(), stats = await sharp(file).stats()
  if (!metadata.hasAlpha || stats.channels[3]?.min !== 0) throw new Error(`${name}: transparency required`)
  const result = await sharp(file).resize({ width: 96, height: 96, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 95, effort: 5 }).toFile(path.join(target, `${name}-96.webp`))
  console.log(`${name}-96.webp ${result.size} bytes`)
}
