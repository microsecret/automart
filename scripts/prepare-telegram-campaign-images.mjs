// Server only. The two source PNGs are kept outside git in the named input dir.
import sharp from "sharp"
import { mkdir, stat } from "node:fs/promises"
import path from "node:path"

const input = process.argv[2]
if (!input) throw new Error("Usage: node scripts/prepare-telegram-campaign-images.mjs <master-directory>")
const destination = "public/images/telegram/campaign-v1"
await mkdir(destination, { recursive: true })
for (const kind of ["registration", "seller"]) {
  const source = path.join(input, `${kind}-master.png`)
  const metadata = await sharp(source).metadata()
  if (metadata.width !== 1536 || metadata.height !== 1024) throw new Error(`Unexpected master size: ${kind}`)
  const file = path.join(destination, `${kind}.jpg`)
  await sharp(source).jpeg({ quality: 88, mozjpeg: true }).toFile(file)
  const bytes = (await stat(file)).size
  if (bytes > 1000000) throw new Error(`Campaign image too large: ${kind}`)
  console.log(`${kind}: ${metadata.width}x${metadata.height}, ${bytes} bytes`)
}
