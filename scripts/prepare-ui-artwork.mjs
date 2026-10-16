// Run on the build server: node scripts/prepare-ui-artwork.mjs <source-directory> [output-directory].
// Generated masters stay outside public/; only bounded WebP sizes are shipped.
import fs from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const sourceDirectory = process.argv[2]
if (!sourceDirectory) throw new Error("A source directory is required")
const outputDirectory = path.resolve(process.argv[3] || "public/images/ui/titanium-v1")
const artwork = ["auctions", "fuel-map", "garage", "partner", "history-check", "publish-listing", "valuation", "matching", "safe-deal", "documents", "parts"]
await fs.mkdir(outputDirectory, { recursive: true })

for (const name of artwork) {
  const source = path.join(sourceDirectory, `icon-${name}.png`)
  const metadata = await sharp(source).metadata()
  if (!metadata.hasAlpha) throw new Error(`${name}: an alpha channel is required`)
  for (const size of [320, 640]) {
    const target = path.join(outputDirectory, `${name}-${size}.webp`)
    const result = await sharp(source)
      .resize({ width: size, height: size, fit: "contain", withoutEnlargement: true })
      .webp({ quality: 84, alphaQuality: 90, effort: 5 })
      .toFile(target)
    console.log(`${path.basename(target)} ${result.width}x${result.height} ${result.size} bytes`)
  }
}
