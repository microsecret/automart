// Run on the server with the existing sharp installation.
import sharp from "sharp"
import { mkdir } from "node:fs/promises"
import path from "node:path"
const source = process.argv[2]
if (!source) throw new Error("Source directory required")
const target = "public/images/ui/product-v1"
await mkdir(target, { recursive: true })
for (const name of ["filter", "sparkplug", "belt", "oil"]) {
  const input = sharp(path.join(source, `${name}.png`))
  const metadata = await input.metadata()
  const stats = await input.stats()
  if (!metadata.hasAlpha || stats.channels.at(-1).min !== 0) throw new Error(`Transparent master required: ${name}`)
  for (const width of [96, 192]) {
    const result = await input.clone().resize({ width, height: width, fit: "inside" }).webp({ quality: 86, effort: 5 }).toFile(path.join(target, `${name}-${width}.webp`))
    console.log(`${name}-${width}: ${result.size} bytes`)
  }
}
