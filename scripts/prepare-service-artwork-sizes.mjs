// Server only. Reuse existing approved derivatives and derive only missing sizes.
import sharp from "sharp"
import { readFile, access } from "node:fs/promises"

const component = await readFile("src/components/ui/ServiceArtwork.tsx", "utf8")
const kinds = component.slice(component.indexOf("export type ServiceArtworkKind"), component.indexOf("/**"))
for (const [, kind] of kinds.matchAll(/"([a-z-]+)"/g)) {
  const prefix = `public/images/ui/titanium-v1/${kind}`
  for (const width of [320, 640]) await access(`${prefix}-${width}.webp`)
  try { await access(`${prefix}-96.webp`); continue } catch (error) { if (error.code !== "ENOENT") throw error }
  const source = `${prefix}-320.webp`
  if (!(await sharp(source).metadata()).hasAlpha) throw new Error(`Transparent source required: ${source}`)
  const result = await sharp(source).resize({ width: 96, withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 95, effort: 6 }).toFile(`${prefix}-96.webp`)
  console.log(`${kind}-96.webp: ${result.size} bytes`)
}
