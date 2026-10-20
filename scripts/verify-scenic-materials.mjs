// Server-only authenticated render matrix, before/after shared token extraction.
import assert from "node:assert/strict"
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"
import { chromium } from "playwright-core"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
assert.ok(process.env.NEXTAUTH_SECRET)
const stage = process.env.SCENIC_AUDIT_STAGE || "after"
assert.ok(["before", "after"].includes(stage))
const output = "/tmp/lewheel-scenic-materials-20261020"
await mkdir(`${output}/${stage}`, { recursive: true })
const db = new PrismaClient()
const results = []
const snapshots = {}
let browser
function check(name, condition) { assert.ok(condition, name); results.push(name); console.log(`PASS ${name}`) }
try {
  const user = await db.user.create({ data: { name: "Проверка оформления", email: `materials-${Date.now()}@audit.invalid` } })
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, maxAge: 600, token: { id: user.id, sub: user.id, role: user.role } })
  const cookie = `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
  let executablePath = chromium.executablePath()
  try { await access(executablePath) } catch {
    for (const folder of (await readdir("/root/.cache/ms-playwright")).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse()) {
      const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
      try { await access(candidate); executablePath = candidate; break } catch { /* next installed browser */ }
    }
  }
  browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  const baseline = stage === "after" ? JSON.parse(await readFile(`${output}/before/styles.json`, "utf8")) : null
  const routes = [
    { name: "home", path: "/", selector: ".lw-scenic-tile" },
    { name: "services", path: "/services", selector: ".service-hub-hero" },
    { name: "garage", path: "/dashboard?tab=garage", selector: '.lw-scenic-banner[data-scene="garage"]' },
    { name: "subscriptions", path: "/dashboard?tab=subscriptions", selector: '.lw-scenic-banner[data-scene="subscriptions"]' },
  ]
  for (const mobile of [false, true]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: "reduce", extraHTTPHeaders: { Cookie: cookie } })
    await context.addInitScript((value) => localStorage.setItem("automart-color-scheme", value), theme)
    await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    for (const route of routes) {
      const name = `${route.name}-${mobile ? "mobile" : "desktop"}-${theme}`
      const page = await context.newPage()
      const response = await page.goto(`${base}${route.path}`, { waitUntil: "networkidle" })
      check(`${name}: route loads`, response.status() === 200)
      await page.locator(`html[data-mantine-color-scheme="${theme}"]`).waitFor()
      await page.locator(route.selector).first().waitFor()
      await page.evaluate(async () => {
        const localImages = [...document.querySelectorAll('img[src*="/images/ui/"]')]
        await Promise.all(localImages.map((image) => image.decode().catch(() => {})))
      })
      check(`${name}: viewport has no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      check(`${name}: decorative scenes load`, await page.locator(`${route.selector} img`).evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0 && image.getAttribute("alt") === "")))
      snapshots[name] = await page.evaluate(() => {
        const selectors = [".lw-scenic-banner", ".lw-scenic-banner__image", ".lw-scenic-tile", ".home-quick__label", ".home-quick__note", ".home-quick__arrow", ".side-widget__head", ".market-side-account__head", ".service-hub-hero", ".partner-header-cta", ".header-create-cta"]
        const properties = ["backgroundColor", "backgroundImage", "color", "borderRadius", "minHeight", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "objectFit", "objectPosition", "maskImage"]
        return selectors.flatMap((selector) => [...document.querySelectorAll(selector)].slice(0, 8).map((element, index) => ({
          selector, index,
          style: Object.fromEntries(properties.map((property) => [property, getComputedStyle(element)[property]])),
          overlay: [".lw-scenic-banner", ".lw-scenic-tile"].includes(selector) ? getComputedStyle(element, "::before").backgroundImage + getComputedStyle(element, "::before").backgroundColor : null,
        })))
      })
      if (baseline) {
        assert.deepEqual(snapshots[name], baseline[name], `${name}: approved rendered materials changed`)
        check(`${name}: approved computed styles preserved`, true)
      }
      await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0) })
      await page.screenshot({ path: `${output}/${stage}/${name}.png` })
      await page.close()
    }
    await context.close()
  }
  await writeFile(`${output}/${stage}/styles.json`, JSON.stringify(snapshots, null, 2))
  await writeFile(`${output}/${stage}/report.json`, JSON.stringify({ stage, results, failures: [] }, null, 2))
  console.log(`SCENIC_MATERIALS_VERIFIED stage=${stage} checks=${results.length} views=${Object.keys(snapshots).length}`)
} finally { await browser?.close(); await db.$disconnect() }
