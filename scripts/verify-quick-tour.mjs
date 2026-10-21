import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright-core"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
const output = "/tmp/lewheel-quick-tour-20261021"
await mkdir(output, { recursive: true })
const results = []
const panelColors = []
function check(name, condition) { assert.ok(condition, name); results.push(name); console.log(`PASS ${name}`) }
let executablePath = chromium.executablePath()
try { await access(executablePath) } catch {
  for (const folder of (await readdir("/root/.cache/ms-playwright")).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse()) {
    const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
    try { await access(candidate); executablePath = candidate; break } catch { /* next installed browser */ }
  }
}
const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
try {
  for (const mobile of [false, true]) {
  for (const theme of ["light", "dark"]) {
    const name = `${mobile ? "mobile-reduced" : "desktop"}-${theme}`
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: mobile ? "reduce" : "no-preference" })
    await context.addInitScript((theme) => localStorage.setItem("automart-color-scheme", theme), theme)
    await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    const page = await context.newPage()
    await page.goto(base, { waitUntil: "domcontentloaded" })
    const input = page.locator(".home-hero__search input")
    await input.fill("Honda")
    await page.waitForTimeout(2200)
    const tour = page.getByRole("region", { name: "Подсказки по каталогу", exact: true })
    check(`${name}: typing prevents automatic interruption`, await tour.count() === 0 && await input.inputValue() === "Honda")
    const launch = page.getByRole("button", { name: "Как пользоваться каталогом", exact: true })
    await launch.click()
    await tour.waitFor()
    const close = tour.getByRole("button", { name: "Закрыть подсказки", exact: true })
    await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Закрыть подсказки")
    check(`${name}: manual start focuses its controls`, await close.evaluate((element) => element === document.activeElement))
    check(`${name}: overlay is a nonmodal region`, await tour.getAttribute("aria-modal") === null)
    check(`${name}: close has a 44px touch target`, await close.evaluate((element) => element.getBoundingClientRect().width >= 44 && element.getBoundingClientRect().height >= 44))
    check(`${name}: highlight has no infinite animation`, await page.locator(".lw-tour-target").evaluate((element) => getComputedStyle(element).animationName === "none"))
    if (mobile) check(`${name}: reduced motion disables entry movement`, await tour.evaluate((element) => getComputedStyle(element).animationName === "none"))
    await page.keyboard.press("Escape")
    await tour.waitFor({ state: "detached" })
    check(`${name}: Escape returns focus to launch control`, await launch.evaluate((element) => element === document.activeElement))
    check(`${name}: closing removes highlight`, await page.locator(".lw-tour-target").count() === 0)
    await launch.click()
    await tour.waitFor()
    await tour.getByRole("button", { name: "Далее", exact: true }).click()
    await tour.getByText("Пять быстрых путей", { exact: true }).waitFor()
    check(`${name}: advances without changing search input`, await input.inputValue() === "Honda")
    const bounds = await tour.boundingBox()
    check(`${name}: panel fits horizontally`, bounds.x >= 0 && bounds.x + bounds.width <= (mobile ? 390 : 1440))
    check(`${name}: panel fits vertically`, bounds.y >= 0 && bounds.y + bounds.height <= (mobile ? 844 : 1000))
    const support = await page.getByRole("button", { name: "Открыть поддержку", exact: true }).boundingBox()
    check(`${name}: support launcher does not cover the tour`, !support || bounds.x + bounds.width <= support.x || support.x + support.width <= bounds.x || bounds.y + bounds.height <= support.y || support.y + support.height <= bounds.y)
    panelColors.push(await tour.evaluate((element) => getComputedStyle(element).backgroundColor))
    await page.waitForTimeout(200)
    await page.screenshot({ path: `${output}/${name}.png` })
    await tour.getByRole("button", { name: "Пропустить", exact: true }).click()
    await tour.waitFor({ state: "detached" })
    await page.reload({ waitUntil: "networkidle" })
    await page.waitForTimeout(2000)
    check(`${name}: dismissed tour does not restart on reload`, await tour.count() === 0)
    await launch.click()
    await tour.waitFor()
    check(`${name}: manual replay remains available`, await tour.isVisible())
    for (let step = 0; step < 4 && await tour.count() > 0; step++) {
      await tour.locator(".lw-tour__next").click()
    }
    check(`${name}: tour completes including absent responsive targets`, await tour.count() === 0)
    check(`${name}: completion cleans up its highlight`, await page.locator(".lw-tour-target").count() === 0)
    await context.close()
  }
  }
  check("all themes: panel preserves the same approved teal material", new Set(panelColors).size === 1)
  const idleContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await idleContext.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
  const idlePage = await idleContext.newPage()
  await idlePage.goto(base, { waitUntil: "domcontentloaded" })
  const idleTour = idlePage.getByRole("region", { name: "Подсказки по каталогу", exact: true })
  await idleTour.waitFor()
  check("idle first visit: optional hint appears without stealing focus", !await idleTour.evaluate((element) => element.contains(document.activeElement)))
  await idleContext.close()
  await writeFile(`${output}/report.json`, JSON.stringify({ results, failures: [] }, null, 2))
  console.log(`QUICK_TOUR_VERIFIED checks=${results.length}`)
} finally { await browser.close() }
