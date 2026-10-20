import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"
import { chromium } from "playwright-core"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"))
assert.ok(process.env.NEXTAUTH_SECRET)
const output = process.env.SUBSCRIPTIONS_AUDIT_OUTPUT || "/tmp/lewheel-subscription-controls-20261020"
await mkdir(output, { recursive: true })
const db = new PrismaClient()
const checks = []
let browser
function check(name, condition) { assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`) }
async function cookie(user) {
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, maxAge: 600, token: { id: user.id, sub: user.id, role: user.role } })
  return `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
}
async function patch(auth, body) {
  const response = await fetch(`${base}/api/saved-searches`, { method: "PATCH", headers: { Cookie: auth, "Content-Type": "application/json" }, body: JSON.stringify(body) })
  return { status: response.status, body: await response.json() }
}
async function screenshot(page, path) {
  // A full-page capture keeps fixed chrome at the current scroll offset.
  // Reset scroll/focus so it reflects the normal top-of-page viewport.
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    window.scrollTo(0, 0)
  })
  await page.evaluate(() => Promise.all(document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => {}))))
  await page.screenshot({ path, fullPage: true })
}
try {
  const marker = Date.now()
  const owner = await db.user.create({ data: { name: "Проверка управления", email: `controls-${marker}@audit.invalid` } })
  const other = await db.user.create({ data: { email: `controls-other-${marker}@audit.invalid` } })
  const auth = await cookie(owner)
  const title = "Семейный автомобиль: проверка длинного названия и сохранённых условий поиска"
  const since = new Date(Date.now() - 86400000)
  const search = await db.savedSearch.create({ data: { userId: owner.id, title, scope: "AUCTIONS", query: "country=JP&make=Honda&model=Stepwgn&priceTo=2500000&yearFrom=2021", lastNotifiedAt: since } })
  await db.savedSearchDelivery.create({ data: { userId: owner.id, searchId: search.id, windowStart: since, windowEnd: new Date(), matchCount: 2 } })
  check("anonymous update denied", (await patch("", { id: search.id, notifyTelegram: false })).status === 401)
  check("another owner cannot update search", (await patch(await cookie(other), { id: search.id, notifyTelegram: false })).status === 404)
  check("boolean delivery preference required", (await patch(auth, { id: search.id, notifyTelegram: "false" })).status === 400)
  check("unexpected writable fields rejected", (await patch(auth, { id: search.id, notifyTelegram: false, userId: other.id })).status === 400)
  const paused = await patch(auth, { id: search.id, notifyTelegram: false })
  check("pause preserves filters and title", paused.status === 200 && paused.body.search.notifyTelegram === false && paused.body.search.query === search.query && paused.body.search.title === title)
  check("pause preserves previous matching watermark", (await db.savedSearch.findUniqueOrThrow({ where: { id: search.id } })).lastNotifiedAt.getTime() === since.getTime())
  await patch(auth, { id: search.id, notifyTelegram: true })
  const resumed = await db.savedSearch.findUniqueOrThrow({ where: { id: search.id } })
  check("resume skips the paused interval and awaits a fresh check", resumed.lastNotifiedAt > since && resumed.lastCheckedAt === null && resumed.lastMatchCount === 0)
  await patch(auth, { id: search.id, notifyTelegram: true })
  check("retrying enable does not move watermark again", (await db.savedSearch.findUniqueOrThrow({ where: { id: search.id } })).lastNotifiedAt.getTime() === resumed.lastNotifiedAt.getTime())
  check("pause and resume do not erase daily delivery budget", await db.savedSearchDelivery.count({ where: { userId: owner.id } }) === 1)

  let executablePath = chromium.executablePath()
  try { await access(executablePath) } catch {
    for (const folder of (await readdir("/root/.cache/ms-playwright")).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse()) {
      const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
      try { await access(candidate); executablePath = candidate; break } catch { /* next installed browser */ }
    }
  }
  browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  for (const mobile of [false, true]) {
    const name = mobile ? "mobile-dark" : "desktop-light"
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: mobile ? "reduce" : "no-preference", extraHTTPHeaders: { Cookie: auth } })
    await context.addInitScript((theme) => localStorage.setItem("automart-color-scheme", theme), mobile ? "dark" : "light")
    await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    const page = await context.newPage()
    await page.goto(`${base}/dashboard?tab=subscriptions`, { waitUntil: "networkidle" })
    const toggle = page.getByRole("switch", { name: `Уведомления: ${title}`, exact: true })
    await toggle.waitFor()
    await page.locator(`html[data-mantine-color-scheme="${mobile ? "dark" : "light"}"]`).waitFor()
    check(`${name}: selected conditions visible`, await page.getByText("Honda", { exact: false }).count() > 0)
    await page.getByText("Как управлять подписками", { exact: true }).click()
    check(`${name}: short tutorial opens`, await page.getByText("Поставьте уведомления на паузу, если пока не ищете. Сам поиск останется.", { exact: true }).isVisible())
    const failUpdate = (route) => route.request().method() === "PATCH" ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Временно недоступно. Повторите попытку." }) }) : route.continue()
    await page.route("**/api/saved-searches", failUpdate)
    await toggle.click()
    await page.getByRole("alert").filter({ hasText: "Изменение не сохранено" }).waitFor()
    check(`${name}: failed update preserves active switch`, await toggle.isChecked())
    await page.unroute("**/api/saved-searches", failUpdate)
    await toggle.click()
    await page.getByText("На паузе", { exact: true }).waitFor()
    check(`${name}: pause updates state without deleting search`, !await toggle.isChecked() && await page.getByRole("heading", { name: title }).isVisible())
    check(`${name}: layout fits viewport`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await screenshot(page, `${output}/${name}-paused.png`)
    await toggle.focus()
    await toggle.press("Space")
    await page.getByText("Следим за новыми", { exact: true }).waitFor()
    check(`${name}: keyboard resumes notification delivery`, await toggle.isChecked())
    await screenshot(page, `${output}/${name}-active.png`)
    await context.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ checks, failures: [] }, null, 2))
  console.log(`SUBSCRIPTION_CONTROLS_VERIFIED checks=${checks.length}`)
} finally { await browser?.close(); await db.$disconnect() }
