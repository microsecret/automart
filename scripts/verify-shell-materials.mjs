// Server-only render matrix against a disposable audit database.
import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"
import { chromium } from "playwright-core"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
assert.ok(process.env.NEXTAUTH_SECRET)
const output = "/tmp/lewheel-shell-materials-20261021"
await mkdir(output, { recursive: true })
const results = []
const check = (name, value) => { assert.ok(value, name); results.push(name); console.log(`PASS ${name}`) }
const db = new PrismaClient()
let browser
try {
  const user = await db.user.create({ data: { name: "Проверка стиля", email: `shell-${Date.now()}@audit.invalid` } })
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, maxAge: 600, token: { id: user.id, sub: user.id, role: user.role } })
  let executablePath = chromium.executablePath()
  try { await access(executablePath) } catch {
    for (const folder of (await readdir("/root/.cache/ms-playwright")).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse()) {
      const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
      try { await access(candidate); executablePath = candidate; break } catch { /* next installed browser */ }
    }
  }
  browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  for (const mobile of [false, true]) for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: "reduce", extraHTTPHeaders: { Cookie: `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}` } })
    await context.addInitScript((theme) => { localStorage.setItem("automart-color-scheme", theme); localStorage.setItem("lw-quick-tour-v1", "done") }, theme)
    await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    for (const [name, path] of [["home", "/"], ["auctions", "/auctions"], ["profile", "/dashboard?tab=profile"], ["services", "/services"]]) {
      const key = `${name}-${mobile ? "mobile" : "desktop"}-${theme}`
      const page = await context.newPage()
      const response = await page.goto(base + path, { waitUntil: "networkidle" })
      check(`${key}: loads`, response.status() === 200)
      await page.locator(`html[data-mantine-color-scheme="${theme}"]`).waitFor()
      check(`${key}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      check(`${key}: titanium border token`, await page.evaluate((dark) => getComputedStyle(document.documentElement).getPropertyValue("--market-line").trim() === (dark ? "#34464b" : "#c5d3d2"), theme === "dark"))
      check(`${key}: copper partner CTA retained`, await page.locator(".partner-header-cta").first().evaluate((element) => getComputedStyle(element).backgroundImage.includes("gradient")))
      if (!mobile) {
        check(`${key}: navigation uses one tone`, await page.locator(".market-side-nav--toned").evaluateAll((nodes) => nodes.length > 0 && new Set(nodes.map((node) => getComputedStyle(node).getPropertyValue("--nav-tone").trim())).size === 1))
        check(`${key}: avatar uses enamel`, await page.locator(".market-side-account__avatar.lw-user-avatar").evaluate((element) => getComputedStyle(element).backgroundImage.includes("gradient")))
      }
      if (name === "home") {
        const input = page.locator(".home-hero__search input")
        await input.fill("Honda")
        await input.focus()
        check(`${key}: search keeps input and visible focus`, await input.evaluate((element) => element.value === "Honda" && getComputedStyle(element).boxShadow !== "none"))
      }
      if (name === "profile") {
        await page.locator(".lw-user-avatar").first().waitFor()
        check(`${key}: profile monogram is real text`, await page.locator(".lw-user-avatar .mantine-Avatar-placeholder").count() > 0)
      }
      check(`${key}: identity frames use the same circular shape`, await page.locator(".lw-user-avatar").evaluateAll((avatars) => avatars.every((avatar) => getComputedStyle(avatar).borderRadius === "50%")))
      check(`${key}: monograms have readable contrast across both enamel stops`, await page.locator(".lw-user-avatar").evaluateAll((avatars) => {
        const luminance = (color) => {
          const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
          return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        }
        return avatars.every((avatar) => {
          const text = avatar.querySelector(".mantine-Avatar-placeholder")
          if (!text) return true
          const foreground = luminance(getComputedStyle(text).color)
          const stops = getComputedStyle(avatar).backgroundImage.match(/rgba?\([^)]*\)/g) || []
          return stops.length >= 2 && stops.every((color) => {
            const background = luminance(color)
            return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) >= 4.5
          })
        })
      }))
      await page.screenshot({ path: `${output}/${key}.png` })
      await page.close()
    }
    await context.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ checks: results.length, results, failures: [] }, null, 2))
  console.log(`SHELL_MATERIALS_VERIFIED checks=${results.length}`)
} finally { await browser?.close(); await db.$disconnect() }
