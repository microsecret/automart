// Real public pages in a disposable server audit; external requests stay blocked.
import assert from "node:assert/strict"
import { access, mkdir, readdir, stat, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
const output = "/tmp/lewheel-service-artwork-20261030"
await mkdir(output, { recursive: true })
let executablePath = chromium.executablePath()
try { await access(executablePath) } catch {
  for (const directory of (await readdir("/root/.cache/ms-playwright")).filter(x => /^chromium-\d+$/.test(x)).sort().reverse()) {
    const candidate = `/root/.cache/ms-playwright/${directory}/chrome-linux64/chrome`
    try { await access(candidate); executablePath = candidate; break } catch { /* next installed browser */ }
  }
}
const checks = []
const measurements = []
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`) }
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
try {
  for (const width of [390, 1560]) for (const theme of ["light", "dark"]) for (const density of [1, 2]) {
    for (const path of ["/help/sell", "/help/support", "/help", "/services"]) {
      // A fresh context per route avoids a larger cached candidate masking selection.
      const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: density, reducedMotion: "reduce" })
      try {
        await context.addInitScript(value => { localStorage.setItem("automart-color-scheme", value); localStorage.setItem("lw-quick-tour-v1", "done") }, theme)
        await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
        const page = await context.newPage()
        const name = `${path}-${width}-${theme}-${density}x`
        const response = await page.goto(base + path, { waitUntil: "networkidle" })
        check(name + ": loads", response.status() === 200)
        await page.locator(`html[data-mantine-color-scheme="${theme}"]`).waitFor()
        const art = page.locator(".lw-service-artwork")
        check(name + ": artwork exists", await art.count() >= 3)
        await art.evaluateAll(async images => { for (const image of images) image.loading = "eager"; await Promise.all(images.map(image => image.decode())) })
        const rows = await art.evaluateAll(images => images.map(image => {
          const rect = image.getBoundingClientRect(), style = getComputedStyle(image)
          return { source: image.currentSrc, natural: image.naturalWidth, width: rect.width, height: rect.height,
            intended: Number(image.getAttribute("width")), hidden: image.alt === "" && image.getAttribute("aria-hidden") === "true", fit: style.objectFit }
        }))
        check(name + ": complete images in unchanged square frames", rows.every(row => row.natural > 0 && row.width === row.height && row.fit === "contain" && row.hidden))
        check(name + ": density-appropriate candidate", rows.every(row => {
          const expected = [96, 320, 640].find(size => size >= row.intended * density) || 640
          // naturalWidth is density-corrected for width-descriptor srcsets.
          return row.source.endsWith(`-${expected}.webp`)
        }))
        const unique = [...new Map(rows.map(row => [row.source, row])).values()]
        let before = 0, after = 0
        const originalFiles = new Set(rows.map(row => `public${new URL(row.source).pathname}`
          .replace(/-(96|320|640)\.webp$/, `-${row.intended > 160 ? 640 : 320}.webp`)))
        for (const row of unique) {
          const file = `public${new URL(row.source).pathname}`
          after += (await stat(file)).size
        }
        for (const file of originalFiles) before += (await stat(file)).size
        measurements.push({ view: name, before, after })
        check(name + ": image bytes do not increase", after <= before)
        check(name + ": no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        if (path === "/services") check(name + ": direct-child layout and real links", await page.locator(".lw-service-widget").evaluateAll(cards => cards.length >= 6 && cards.every(card => card.querySelector(":scope > img.lw-service-artwork") && card.getAttribute("href")?.startsWith("/services/"))))
        if (path === "/help/sell") check(name + ": publish action retained", await page.getByRole("link", { name: "Разместить", exact: true }).getAttribute("href") === "/listings/create/vehicle")
        if (density === 2 && ["/help/support", "/services"].includes(path)) await page.screenshot({ path: `${output}/${path.slice(1).replaceAll("/", "-")}-${width}-${theme}.png` })
      } finally { await context.close() }
    }
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ checks: checks.length, results: checks, measurements }, null, 2))
  console.log(`SERVICE_ARTWORK_VERIFIED checks=${checks.length}`)
} finally { await browser.close() }
