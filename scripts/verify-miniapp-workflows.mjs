// Server only. Real local API/DB and browser flows, with all external traffic blocked.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"
import bcrypt from "bcryptjs"
import { chromium } from "playwright-core"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.match(process.env.DATABASE_URL || "", /^file:\/tmp\/automart-auth-audit\.[\w-]+\/automart-audit\.db$/)
assert.equal(process.env.TELEGRAM_BOT_TOKEN, "audit-only-token", "Live Telegram token must be replaced in both server and audit process")
assert.ok(process.env.NEXTAUTH_SECRET)
const output = "/tmp/lewheel-miniapp-workflows-20261103"
await mkdir(output, { recursive: true })
const db = new PrismaClient(), checks = []
let browser
function check(label, value) { assert.ok(value, label); checks.push(label); console.log(`PASS ${label}`) }

function signedInitData(telegramId, startParam) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: Number(telegramId), first_name: "Аудит", username: "lewheel_audit" }),
  })
  if (startParam) params.set("start_param", startParam)
  const data = Array.from(params.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join("\n")
  const secret = crypto.createHmac("sha256", "WebAppData").update("audit-only-token").digest()
  params.set("hash", crypto.createHmac("sha256", secret).update(data).digest("hex"))
  return params.toString()
}

async function contextFor(owner, mobile, { cookie = true, startParam } = {}) {
  const token = cookie ? await encode({
    secret: process.env.NEXTAUTH_SECRET, maxAge: 1800,
    token: { id: owner.id, sub: owner.id, role: owner.role, sessionVersion: owner.sessionVersion },
  }) : null
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce",
    ...(token ? { extraHTTPHeaders: { Cookie: `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}` } } : {}),
  })
  await context.addInitScript((initData) => {
    const noop = () => {}
    window.Telegram = { WebApp: {
      initData, initDataUnsafe: {}, version: "9.0", platform: "android", themeParams: {},
      ready: noop, expand: noop, disableVerticalSwipes: noop,
      setHeaderColor: noop, setBackgroundColor: noop, setBottomBarColor: noop,
      onEvent: noop, offEvent: noop,
      HapticFeedback: { impactOccurred: noop, selectionChanged: noop, notificationOccurred: noop },
      MainButton: { setParams: noop, setText: noop, onClick: noop, offClick: noop, show: noop, hide: noop },
      BackButton: {
        onClick: (handler) => { window.__lewheelAuditBack = handler },
        offClick: (handler) => { if (window.__lewheelAuditBack === handler) delete window.__lewheelAuditBack },
        show: noop, hide: noop,
      },
    } }
    localStorage.setItem("lw-quick-tour-v1", "done")
    localStorage.setItem("lw-mini-onboarding-v1", "done")
  }, signedInitData(owner.telegramId, startParam))
  await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
  return context
}

try {
  const marker = Date.now()
  const owner = await db.user.create({ data: {
    name: "Аудит Mini App", email: `miniapp-${marker}@audit.invalid`, emailVerified: new Date(),
    telegramId: "990000000001", phone: "+79900000001", telegramVerifiedAt: new Date(),
    hashedPassword: await bcrypt.hash("Audit-only-pass-2026", 4),
  } })
  const peers = [], conversations = []
  for (let index = 0; index < 31; index++) {
    const peer = await db.user.create({ data: { name: index === 0 ? "АрхивЁж" : `Собеседник ${index}`, email: `mini-peer-${marker}-${index}@audit.invalid` } })
    peers.push(peer)
    const conversationId = `${[owner.id, peer.id].sort().join("-")}-no-listing`
    conversations.push(conversationId)
    const message = await db.message.create({ data: {
      conversationId, senderId: peer.id, receiverId: owner.id,
      content: index === 30 ? "" : index === 0 ? "Архивный ответ вне первой страницы" : `Текст сообщения ${index}`,
      createdAt: new Date(marker - (31 - index) * 60000),
    } })
    if (index === 30) await db.messageAttachment.create({ data: {
      messageId: message.id, fileName: "audit-photo.jpg", mimeType: "image/jpeg", size: 100,
      storageKey: `miniapp-audit-${marker}.jpg`, uploadedById: peer.id,
    } })
  }

  let executablePath = chromium.executablePath()
  try { await access(executablePath) } catch {
    for (const folder of (await readdir("/root/.cache/ms-playwright")).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse()) {
      const candidate = `/root/.cache/ms-playwright/${folder}/chrome-linux64/chrome`
      try { await access(candidate); executablePath = candidate; break } catch { /* next browser */ }
    }
  }
  browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] })

  for (const mobile of [false, true]) {
    const label = mobile ? "mobile" : "desktop"
    const context = await contextFor(owner, mobile)
    const page = await context.newPage(), errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${base}/telegram?tab=chats`, { waitUntil: "networkidle" })
    const search = page.getByRole("searchbox", { name: "Поиск по всем диалогам" })
    await page.getByText("Всего диалогов: 31", { exact: true }).waitFor()
    check(`${label}: first mailbox page has thirty rows`, await page.locator(".tg-chat").count() === 30)
    check(`${label}: attachment-only preview is meaningful`, await page.getByText("Фото: 1", { exact: true }).count() === 1)
    check(`${label}: archived conversation starts outside first page`, await page.getByText("АрхивЁж", { exact: true }).count() === 0)
    await page.getByRole("button", { name: "Следующая страница диалогов", exact: true }).click()
    await page.getByText("АрхивЁж", { exact: true }).waitFor()
    check(`${label}: second page reaches thirty-first conversation`, await page.locator(".tg-chat").count() === 1)
    check(`${label}: next control stops at last page`, await page.getByRole("button", { name: "Следующая страница диалогов", exact: true }).isDisabled())
    await search.fill("аРхИвёЖ")
    await page.getByText("Найдено диалогов: 1", { exact: true }).waitFor()
    check(`${label}: search covers entire mailbox and returns page one`, await page.getByText("АрхивЁж", { exact: true }).count() === 1 && await page.getByText("Страница 2 из 2", { exact: true }).count() === 0)
    check(`${label}: typing preserves search focus`, await search.evaluate((node) => node === document.activeElement))
    await search.fill("НеСуществуетТакогоСообщения")
    await page.getByText("Ничего не найдено", { exact: true }).waitFor()
    await page.getByRole("button", { name: "Сбросить поиск", exact: true }).click()
    await page.getByText("Всего диалогов: 31", { exact: true }).waitFor()
    check(`${label}: search reset restores focus and full count`, await search.inputValue() === "" && await search.evaluate((node) => node === document.activeElement))
    check(`${label}: no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    check(`${label}: pager controls remain touch-sized`, await page.getByRole("button", { name: "Следующая страница диалогов", exact: true }).evaluate((node) => node.getBoundingClientRect().width >= 44 && node.getBoundingClientRect().height >= 44))
    await page.screenshot({ path: `${output}/messages-${label}.png`, fullPage: true })

    if (!mobile) {
      let forcedStatus = 500
      await context.route("**/api/messages?**", async (route) => {
        const url = new URL(route.request().url())
        if (forcedStatus && url.searchParams.has("page")) return route.fulfill({ status: forcedStatus, json: { error: "Audit failure" } })
        return route.continue()
      })
      await page.reload({ waitUntil: "networkidle" })
      await page.getByText("Не удалось загрузить переписку", { exact: true }).waitFor()
      check("500 is recoverable and does not pretend the user is logged out", await page.getByText("Войдите, чтобы читать переписку", { exact: true }).count() === 0)
      await page.screenshot({ path: `${output}/messages-error-desktop.png`, fullPage: true })
      forcedStatus = 0
      await page.getByRole("button", { name: "Повторить", exact: true }).click()
      await page.getByText("Всего диалогов: 31", { exact: true }).waitFor()
      check("retry restores mailbox after transient API error", await page.locator(".tg-chat").count() === 30)
      forcedStatus = 401
      await page.reload({ waitUntil: "networkidle" })
      await page.getByText("Войдите, чтобы читать переписку", { exact: true }).waitFor()
      check("401 presents a real sign-in destination", await page.getByRole("link", { name: /Войти через бота|Войти в аккаунт/ }).count() === 1)
    }
    check(`${label}: no runtime errors`, errors.length === 0)
    await context.close()
  }

  // A visible mailbox receives a new reply without navigation or manual reload.
  const live = await contextFor(owner, true), livePage = await live.newPage()
  let mailboxRequests = 0
  livePage.on("request", (request) => { const url = new URL(request.url()); if (url.pathname === "/api/messages" && url.searchParams.has("page")) mailboxRequests++ })
  await livePage.goto(`${base}/telegram?tab=chats`, { waitUntil: "networkidle" })
  await livePage.getByText("Всего диалогов: 31", { exact: true }).waitFor()
  await db.message.create({ data: { conversationId: conversations[0], senderId: peers[0].id, receiverId: owner.id, content: "Новый ответ видимой вкладки" } })
  await livePage.getByText("Новый ответ видимой вкладки", { exact: true }).waitFor({ timeout: 25000 })
  check("visible mailbox refreshes new replies within polling interval", mailboxRequests >= 2)
  await livePage.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" })
    document.dispatchEvent(new Event("visibilitychange"))
  })
  const beforeHidden = mailboxRequests
  await livePage.waitForTimeout(21000)
  check("hidden mailbox does not poll", mailboxRequests === beforeHidden)
  await live.close()

  // No existing cookies: the signed Telegram identity must create a real session.
  const targets = [
    { start: "create", path: "/listings/create/vehicle", query: "source=telegram" },
    { start: "createpart", path: "/listings/create/part", query: "from=telegram" },
    { start: "payments", path: "/dashboard", query: "tab=payments" },
    { start: "promote", path: "/dashboard", query: "tab=listings" },
    { start: "dashboard", path: "/dashboard", query: "from=telegram" },
    { start: "create", signedStart: "payments", path: "/dashboard", query: "tab=payments" },
  ]
  for (const target of targets) {
    const context = await contextFor(owner, true, { cookie: false, startParam: target.signedStart })
    const page = await context.newPage()
    check(`${target.start}/${target.signedStart || "URL"}: starts without auth cookie`, (await context.cookies()).length === 0)
    await page.goto(`${base}/telegram?start=${target.start}`, { waitUntil: "domcontentloaded" })
    await page.waitForURL((url) => url.pathname === target.path && url.search.includes(target.query), { timeout: 20000 })
    const response = await context.request.get(`${base}/api/auth/session`)
    const session = await response.json()
    check(`${target.start}/${target.signedStart || "URL"}: signed Mini App login reaches intended destination`, response.status() === 200 && session.user?.id === owner.id)
    check(`${target.start}/${target.signedStart || "URL"}: never falls back to password form`, !page.url().includes("/auth/signin"))
    if (target.path === "/dashboard" && target.query === "tab=payments") {
      await page.getByRole("heading", { name: "Оплаты", exact: true }).waitFor()
      if (!target.signedStart) await page.screenshot({ path: `${output}/payments-mobile.png`, fullPage: true })
      await page.evaluate(() => {
        if (typeof window.__lewheelAuditBack !== "function") throw new Error("Telegram BackButton handler missing")
        window.__lewheelAuditBack()
      })
      await page.waitForURL((url) => url.pathname === "/telegram" && !url.searchParams.has("start"), { timeout: 20000 })
      await page.locator(".tg-shell__title").filter({ hasText: "Свежие объявления" }).waitFor()
      await page.waitForLoadState("networkidle")
      check(`payments ${target.signedStart ? "signed" : "URL"} entry Back returns to feed without repeating its automatic redirect`, new URL(page.url()).pathname === "/telegram")
    }
    await context.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ mode: "isolated database; audit-only bot token; external network blocked", checks, failures: [] }, null, 2))
  console.log(`MINIAPP_WORKFLOWS_VERIFIED checks=${checks.length}`)
} finally { await browser?.close(); await db.$disconnect() }
