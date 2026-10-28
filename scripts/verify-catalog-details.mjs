// Isolated browser audit. No production accounts, messages or catalog writes.
import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
const output = "/tmp/lewheel-catalog-details-20261028"
await mkdir(output, { recursive: true })
const results = []
const failures = []
const check = (name, condition) => { results.push(name); if (!condition) failures.push(name); console.log((condition ? "PASS " : "FAIL ") + name) }
let executablePath = chromium.executablePath()
try { await access(executablePath) } catch {
  for (const folder of (await readdir("/root/.cache/ms-playwright")).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()) {
    const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
    try { await access(candidate); executablePath = candidate; break } catch { /* next browser */ }
  }
}
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
try {
  for (const [device, viewport] of [["desktop", { width: 1560, height: 1000 }], ["tablet", { width: 820, height: 1100 }], ["mobile", { width: 390, height: 844 }]]) for (const theme of ["light", "dark"]) {
    const mobile = device === "mobile"
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" })
    await context.addInitScript(value => { localStorage.setItem("automart-color-scheme", value); localStorage.setItem("lw-quick-tour-v1", "done") }, theme)
    await context.route("**/*", route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    const page = await context.newPage()
    const response = await page.goto(base + "/parts-finder", { waitUntil: "networkidle" })
    check(`parts ${device} ${theme}: HTTP 200`, response.status() === 200)
    await page.locator(`html[data-mantine-color-scheme="${theme}"]`).waitFor()
    const tabs = ["Запчасти", "Масла и жидкости", "Шины и диски", "Автохимия", "Аксессуары", "Инструменты"]
    const keys = new Set()
    for (const label of tabs) {
      const name = `${label}-${device}-${theme}`
      await page.getByRole("tab", { name: label, exact: true }).click()
      await page.getByRole("tab", { name: label, exact: true }).and(page.locator('[aria-selected="true"]')).waitFor()
      const groups = page.locator("[data-product-group]")
      check(name + ": all groups illustrated", await groups.count() > 0 && await groups.locator("img").count() === await groups.count())
      for (const key of await groups.evaluateAll(els => els.map(el => el.dataset.productGroup))) keys.add(key)
      await groups.locator("img").evaluateAll(async images => { for (const img of images) img.loading = "eager"; await Promise.all(images.map(img => img.decode())) })
      check(name + ": transparent art decoded", await groups.locator("img").evaluateAll(images => images.every(img => img.naturalWidth > 0 && img.alt === "")))
      check(name + ": same frame, no stretching or clipping", await groups.locator("img").evaluateAll(images => images.every(img => {
        const box = img.getBoundingClientRect(), parent = img.parentElement.getBoundingClientRect(), style = getComputedStyle(img)
        return box.width === 52 && box.height === 52 && style.objectFit === "contain" && box.left >= parent.left && box.right <= parent.right + 1 && box.top >= parent.top && box.bottom <= parent.bottom + 1
      })))
      check(name + ": compact tiles and aligned labels", await groups.evaluateAll(els => els.every(el => {
        const box = el.getBoundingClientRect(), text = el.querySelector(".mantine-Text-root").getBoundingClientRect(), img = el.querySelector("img").getBoundingClientRect()
        return box.height <= 112 && text.left >= img.right && text.right <= box.right && text.bottom <= box.bottom
      })))
      check(name + ": no viewport overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.screenshot({ path: `${output}/dept-${tabs.indexOf(label)}-${device}-${theme}.png` })
    }
    check(`catalog ${device} ${theme}: full group coverage`, keys.size >= 30)
    await page.getByRole("button", { name: "Каталоги", exact: true }).click()
    const menu = page.locator("#shop-catalog-menu")
    check(`catalog ${device} ${theme}: expanded menu art`, await menu.locator("img").count() === 16)
    if (device === "desktop") await page.screenshot({ path: `${output}/menu-${theme}.png` })
    await page.keyboard.press("Escape")
    check(`catalog ${device} ${theme}: Escape closes menu`, await menu.count() === 0)
    await page.getByRole("button", { name: "Домкраты", exact: true }).click()
    await page.waitForURL(/group=jacks/)
    check(`catalog ${device} ${theme}: artwork preserves group navigation`, page.url().includes("group=jacks"))
    for (const [key, title] of [["sell", "Как продать авто"], ["safety", "Безопасность"], ["rules", "Правила площадки"], ["support", "Поддержка LeWheel"]]) {
      const name = `help-${key}-${device}-${theme}`
      const response = await page.goto(base + "/help/" + key, { waitUntil: "networkidle" })
      check(name + ": HTTP 200", response.status() === 200)
      check(name + ": single real heading", await page.locator("h1").count() === 1 && await page.getByRole("heading", { level: 1, name: title, exact: true }).isVisible())
      await page.locator("[data-section-scene] img").evaluateAll(async images => { await Promise.all(images.map(img => img.decode())) })
      check(name + ": scene decoded", await page.locator("[data-section-scene] img").evaluate(img => img.naturalWidth > 0 && img.alt === ""))
      check(name + ": no overflow", await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.screenshot({ path: `${output}/${name}.png` })
      if (key === "sell") {
        check(name + ": publish destination", await page.getByRole("link", { name: "Разместить", exact: true }).getAttribute("href") === "/listings/create/vehicle")
        check(name + ": step illustrations align beside text", await page.locator("[data-help-step]").evaluateAll(els => els.every(el => {
          const image = el.querySelector("img").getBoundingClientRect(), text = el.querySelector(".mantine-Stack-root").getBoundingClientRect()
          return text.left >= image.right && Math.abs(image.top - text.top) < 1
        })))
      }
      if (key === "support") {
        await page.getByRole("button", { name: "Открыть чат", exact: true }).click()
        await page.getByRole("button", { name: "Закрыть чат", exact: true }).waitFor()
        check(name + ": support launcher still works", true)
        await page.getByRole("button", { name: "Закрыть чат", exact: true }).click()
      }
    }
    await context.close()
  }
  await writeFile(output + "/report.json", JSON.stringify({ checks: results.length, results, failures }, null, 2))
  assert.equal(failures.length, 0, failures.join("\n"))
  console.log(`CATALOG_DETAILS_VERIFIED checks=${results.length} views=60`)
} finally { await browser.close() }
