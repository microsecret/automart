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
const output = "/tmp/lewheel-sidebar-materials-20261022"
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
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 }, isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce", extraHTTPHeaders: { Cookie: `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}` } })
    await context.addInitScript((theme) => { localStorage.setItem("automart-color-scheme", theme); localStorage.setItem("lw-quick-tour-v1", "done") }, theme)
    await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    // Deterministic sidebar content only; never writes to production or adds
    // invented market data to the application. All other endpoints stay real.
    await context.route("**/api/**", (route) => {
      const url = new URL(route.request().url())
      const sample = ["Corolla", "RAV4", "Camry"]
      let body
      if (url.pathname === "/api/news" && url.searchParams.get("limit") === "5") body = { news: sample.map((model, i) => ({ id: `news-${i}`, slug: `audit-${i}`, title: `Автомобильный рынок: ${model}`, publishedAt: new Date().toISOString() })) }
      if (url.pathname === "/api/auctions" && url.searchParams.get("view") === "brief") body = { listings: sample.map((model, i) => ({ id: `lot-${i}`, make: "Toyota", model, year: 2024, priceRub: 2000000 + i * 100000, country: "JP" })) }
      if (url.pathname === "/api/listings" && url.searchParams.get("limit") === "10" && url.searchParams.get("sort") === "newest") body = { listings: sample.map((model, i) => ({ id: `listing-${i}`, price: 1500000, vehicle: { id: `vehicle-${i}`, make: "Toyota", model, year: 2024 } })) }
      return body ? route.fulfill({ json: body }) : route.fallback()
    })
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
        check(`${key}: automotive navigation headings retain readable labels`, await page.locator(".market-side-panel__title").evaluateAll((nodes) => nodes.length > 0 && nodes.every((node) => node.textContent.trim() && getComputedStyle(node).color === "rgb(255, 255, 255)")))
        if (name === "home" || name === "auctions") {
          await page.locator('.side-widget[data-tone="listings"] .sidebar-emblem').waitFor()
          check(`${key}: four distinct market emblems`, await page.locator(".sidebar-emblem svg").evaluateAll((nodes) => nodes.length === 4 && new Set(nodes.map((node) => node.innerHTML)).size === 4))
          check(`${key}: market rail visible and compact`, await page.locator(".side-widget__head").evaluateAll((nodes) => nodes.every((node) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.right <= innerWidth && rect.height >= 40 && rect.height <= 48 })))
          check(`${key}: decorative emblems do not duplicate spoken labels`, await page.locator('.sidebar-emblem[aria-hidden="true"]').count() === 4)
        }
      }
      if (mobile && name === "home") {
        await page.getByRole("button", { name: "Открыть навигацию", exact: true }).click()
        const link = page.locator('.market-side-account__link[href="/dashboard"]').first()
        await link.waitFor({ state: "visible" })
        check(`${key}: mobile account navigation remains reachable`, await link.isVisible())
        check(`${key}: touch navigation targets are at least 44px`, await link.evaluate((node) => node.getBoundingClientRect().height >= 44))
        await page.screenshot({ path: `${output}/${key}-navigation.png` })
        await page.getByRole("button", { name: "Закрыть навигацию", exact: true }).click()
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
