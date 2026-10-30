// Server-only derivation from approved artwork; no dependencies are installed.
import sharp from "sharp"
import { readFile, stat } from "node:fs/promises"

const sources = new Set()
for (const component of ["src/components/sidebar/NavigationArtwork.tsx", "src/components/parts/PartCategoryArtwork.tsx"]) {
  const code = await readFile(component, "utf8")
  for (const match of code.matchAll(/(?:category-v1|titanium-v1)\/[a-z-]+-320(?=[".])/g)) {
    sources.add(`public/images/ui/${match[0]}.webp`)
  }
}
if (!sources.size) throw new Error("No approved navigation artwork found")
let before = 0, after = 0
for (const source of [...sources].sort()) {
  const target = source.replace(/-(320|192)\.webp$/, "-96.webp")
  const metadata = await sharp(source).metadata()
  if (!metadata.hasAlpha) throw new Error(`Transparent source required: ${source}`)
  // Preserve the complete canvas and its proportions; 96px covers 22px at 4x DPR.
  const result = await sharp(source).resize({ width: 96, withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 95, effort: 6 }).toFile(target)
  const size = (await stat(source)).size
  if (result.size >= size) throw new Error(`Compact asset did not save bytes: ${target}`)
  before += size
  after += result.size
  console.log(`${target}: ${result.width}x${result.height}, ${size} -> ${result.size} bytes`)
}
console.log(JSON.stringify({ assets: sources.size, before, after, savedPercent: +(100 * (1 - after / before)).toFixed(1) }))
