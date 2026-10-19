// Authenticated API + browser checks against a disposable database only.
import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"
import { chromium } from "playwright-core"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.ok((process.env.DATABASE_URL || "").includes("audit"), "Disposable database required")
assert.ok(process.env.NEXTAUTH_SECRET)
const output = process.env.SAVED_SEARCH_AUDIT_OUTPUT || "/tmp/lewheel-saved-search-workflow"
await mkdir(output, { recursive: true })
const prisma = new PrismaClient()
const checks = []
let browser
function check(name, condition) { assert.ok(condition, name); checks.push(name); console.log(`PASS ${name}`) }

async function cookie(user) {
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET, maxAge: 600, token: { id: user.id, sub: user.id, name: user.name, email: user.email, role: "USER" } })
  return `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
}
async function post(auth, body) {
  const response = await fetch(`${base}/api/saved-searches`, { method: "POST", headers: { Cookie: auth, "Content-Type": "application/json" }, body: JSON.stringify(body) })
  return { status: response.status, body: await response.json() }
}
try {
  const marker = Date.now()
  const owner = await prisma.user.create({ data: { name: "Проверка подписок", email: `search-owner-${marker}@audit.invalid`, emailVerified: new Date() } })
  const other = await prisma.user.create({ data: { name: "Другой владелец", email: `search-other-${marker}@audit.invalid`, emailVerified: new Date() } })
  const auth = await cookie(owner)
  const otherAuth = await cookie(other)
  const payload = { title: "Honda из Японии", scope: "AUCTIONS", query: "country=JP&make=Honda&priceTo=2000000", notifyTelegram: true }
  const first = await post(auth, payload)
  check("first save creates a subscription", first.status === 201 && first.body.alreadySaved === false)
  const original = await prisma.savedSearch.findUniqueOrThrow({ where: { id: first.body.id } })
  const repeat = await post(auth, { ...payload, title: "Не менять", notifyTelegram: false, query: "make=Honda&priceTo=2000000&country=JP" })
  const unchanged = await prisma.savedSearch.findUniqueOrThrow({ where: { id: first.body.id } })
  check("retry reuses ID and preserves title, delivery preference and clock", repeat.status === 200 && repeat.body.id === first.body.id && unchanged.title === original.title && unchanged.notifyTelegram === original.notifyTelegram && unchanged.lastNotifiedAt.getTime() === original.lastNotifiedAt.getTime())
  const concurrentPayload = { ...payload, query: "country=KR&make=Kia" }
  const pair = await Promise.all([post(auth, concurrentPayload), post(auth, concurrentPayload)])
  check("concurrent identical saves create one row", pair.every((row) => [200, 201].includes(row.status)) && pair[0].body.id === pair[1].body.id && await prisma.savedSearch.count({ where: { userId: owner.id } }) === 2)
  check("invalid scope rejected", (await post(auth, { ...payload, scope: "INVALID" })).status === 400)
  check("oversized query rejected", (await post(auth, { ...payload, query: "a".repeat(4097) })).status === 400)
  const separate = await post(otherAuth, payload)
  check("same filters remain private to each owner", separate.status === 201 && separate.body.id !== first.body.id)
  await prisma.savedSearch.createMany({ data: Array.from({ length: 18 }, (_, i) => ({ userId: owner.id, title: `Лимит ${i}`, scope: "LISTINGS", query: `make=Test${i}` })) })
  check("existing subscription can be reopened at capacity", (await post(auth, payload)).status === 200)
  check("new subscription blocked at capacity", (await post(auth, { ...payload, query: "make=BMW" })).status === 409)
  const deniedDelete = await fetch(`${base}/api/saved-searches?id=${first.body.id}`, { method: "DELETE", headers: { Cookie: otherAuth } })
  check("another owner cannot delete subscription", deniedDelete.status === 404)

  let executablePath = chromium.executablePath()
  try { await access(executablePath) } catch {
    for (const folder of (await readdir("/root/.cache/ms-playwright")).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse()) {
      const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
      try { await access(candidate); executablePath = candidate; break } catch { /* next installed version */ }
    }
  }
  browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })
  for (const mobile of [false, true]) {
    const name = mobile ? "mobile-dark-reduced-motion" : "desktop-light"
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: mobile ? "reduce" : "no-preference" })
    await context.addInitScript((theme) => localStorage.setItem("automart-color-scheme", theme), mobile ? "dark" : "light")
    // Playwright route.continue cannot override Cookie (the browser ignores
    // that header). Context headers work; abort every external request before
    // dispatch so this disposable session never leaves the loopback origin.
    await context.setExtraHTTPHeaders({ Cookie: otherAuth })
    await context.route("**/*", (route) => new URL(route.request().url()).origin === base
      ? route.continue()
      : route.abort())
    const page = await context.newPage()
    await page.goto(`${base}/auctions?${payload.query}`, { waitUntil: "domcontentloaded" })
    await page.waitForFunction((theme) => document.documentElement.getAttribute("data-mantine-color-scheme") === theme, mobile ? "dark" : "light")
    await page.getByRole("button", { name: "Следить за поиском", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("region", { name: "Условия подписки" }).waitFor()
    const summaryText = await dialog.getByRole("region", { name: "Условия подписки" }).innerText()
    check(`${name}: actual filters visible`, summaryText.includes("Япония") && summaryText.includes("Honda"))
    await dialog.getByText("Как работают подписки", { exact: true }).click()
    check(`${name}: optional tutorial opens`, await dialog.getByText("Дайте поиску название и сохраните его.").isVisible())
    const input = dialog.getByLabel("Название подписки", { exact: true })
    await input.fill("")
    await dialog.getByRole("button", { name: "Сохранить подписку", exact: true }).click()
    check(`${name}: empty title gives inline error`, await dialog.getByRole("alert").isVisible())
    await input.fill("Honda из Японии")
    await page.screenshot({ path: `${output}/${name}-form.png` })
    await dialog.getByRole("button", { name: "Сохранить подписку", exact: true }).click()
    await dialog.getByRole("heading", { name: "Этот поиск уже сохранён", exact: true }).waitFor()
    await dialog.locator('[role="status"]').evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished))
    })
    check(`${name}: real API retry gives confirmation and subscription link`, await dialog.getByRole("link", { name: "Мои подписки", exact: true }).getAttribute("href") === "/dashboard?tab=subscriptions")
    check(`${name}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
    check(`${name}: primary action is not covered by floating controls`, await dialog.getByRole("link", { name: "Мои подписки", exact: true }).evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return element.contains(document.elementFromPoint(rect.right - 12, rect.top + rect.height / 2))
    }))
    check(`${name}: requested theme applied`, await page.locator("html").getAttribute("data-mantine-color-scheme") === (mobile ? "dark" : "light"))
    if (mobile) check("reduced motion disables confirmation movement", await dialog.locator('[role="status"]').evaluate((element) => getComputedStyle(element).animationName) === "none")
    await page.screenshot({ path: `${output}/${name}-success.png` })
    await context.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ mode: "authenticated isolated database; no production records", checks, failures: [] }, null, 2))
  console.log(`SAVED_SEARCH_WORKFLOW_VERIFIED checks=${checks.length}`)
} finally {
  if (browser) await browser.close()
  await prisma.$disconnect()
}
