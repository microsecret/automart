// Real browser image selection against a disposable database only.
import assert from "node:assert/strict"
import { access, mkdir, readdir, stat, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
assert.ok(process.env.NEXTAUTH_SECRET)
const output = "/tmp/lewheel-responsive-artwork-20261028"
await mkdir(output, { recursive: true })
const results = []
const db = new PrismaClient()
let browser
const check = (name, condition) => { assert.ok(condition, name); results.push(name); console.log("PASS " + name) }
try {
  // Validate every source pair, including scenes behind authenticated features.
  const folder = "public/images/ui/scenic-v1"
  const pairs = []
  for (const file of (await readdir(folder)).filter(name => name.endsWith("-1600.webp"))) {
    const small = file.replace("-1600.webp", "-960.webp")
    const largeBytes = (await stat(`${folder}/${file}`)).size
    const smallBytes = (await stat(`${folder}/${small}`)).size
    check(`${file}: smaller mobile source exists`, smallBytes > 0 && smallBytes < largeBytes)
    pairs.push({ scene: file.replace("-1600.webp", ""), largeBytes, smallBytes })
  }
  const user = await db.user.create({ data: { name: "Проверка изображений", email: `art-${Date.now()}@audit.invalid` } })
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, maxAge: 1800, token: { id: user.id, sub: user.id, role: user.role } })
  let executablePath = chromium.executablePath()
  try { await access(executablePath) } catch {
    for (const folder of (await readdir("/root/.cache/ms-playwright")).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()) {
      const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
      try { await access(candidate); executablePath = candidate; break } catch { /* next browser */ }
    }
  }
  browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  for (const width of [390, 600, 820, 1560]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: width <= 600 ? 2 : 1, reducedMotion: "reduce" })
    await context.addCookies([{ name: "next-auth.session-token", value: token, url: base }])
    await context.addInitScript(theme => { localStorage.setItem("automart-color-scheme", theme); localStorage.setItem("lw-quick-tour-v1", "done") }, theme)
    await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    for (const [key, path, selector] of [
      ["account", "/dashboard", ".lw-dashboard-welcome img.lw-scenic-banner__image"],
      ["help", "/help", "[data-section-scene] img"],
      ["engine", "/parts-finder/dvigatel", ".part-category__scene"],
    ]) {
      const page = await context.newPage()
      const requests = []
      page.on("request", request => { if (request.url().includes("/scenic-v1/")) requests.push(request.url()) })
      const name = `${key}-${width}-${theme}`
      check(name + ": HTTP 200", (await page.goto(base + path, { waitUntil: "networkidle" })).status() === 200)
      const image = page.locator(selector).first()
      await image.evaluate(img => img.decode())
      const suffix = width <= 600 ? "-960.webp" : "-1600.webp"
      check(name + ": browser selected expected source", (await image.evaluate(img => img.currentSrc)).endsWith(suffix))
      check(name + ": no redundant large mobile download", width > 600 || requests.every(url => !url.endsWith("-1600.webp")))
      check(name + ": decorative image decoded", await image.evaluate(img => img.naturalWidth > 0 && img.alt === "" && img.getAttribute("aria-hidden") === "true"))
      check(name + ": image fits its section", await image.evaluate(img => {
        const a = img.getBoundingClientRect(), b = img.closest("header, section").getBoundingClientRect()
        return a.width > 0 && a.height > 0 && a.left >= b.left - 1 && a.right <= b.right + 1 && a.bottom <= b.bottom + 1
      }))
      check(name + ": no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.screenshot({ path: `${output}/${name}.png` })
      await page.close()
    }
    await context.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ checks: results.length, pairs, results }, null, 2))
  console.log(`RESPONSIVE_ARTWORK_VERIFIED: ${results.length} checks`)
} finally {
  await browser?.close()
  await db.$disconnect()
}
