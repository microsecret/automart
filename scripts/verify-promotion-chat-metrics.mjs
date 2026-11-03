// Server only: isolated DB/API checks, no provider calls or live Telegram posts.
import assert from "node:assert/strict"
import { access, mkdir, readdir, writeFile } from "node:fs/promises"
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"
import { chromium } from "playwright-core"

const base = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
assert.match(base, /^http:\/\/127\.0\.0\.1:\d+$/)
assert.match(process.env.DATABASE_URL || "", /^file:\/tmp\/automart-auth-audit\.[\w-]+\/automart-audit\.db$/)
assert.ok(process.env.NEXTAUTH_SECRET)
const output = "/tmp/lewheel-promotion-chat-metrics-20261103"
await mkdir(output, { recursive: true })
const db = new PrismaClient(), checks = []
let browser
function check(label, value) { assert.ok(value, label); checks.push(label); console.log(`PASS ${label}`) }
async function cookie(user) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET, maxAge: 1800,
    token: { id: user.id, sub: user.id, role: user.role, sessionVersion: user.sessionVersion },
  })
  return `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
}

try {
  const marker = Date.now()
  const owner = await db.user.create({ data: { name: "Продавец аудита", email: `metric-owner-${marker}@audit.invalid` } })
  const other = await db.user.create({ data: { name: "Другой продавец", email: `metric-other-${marker}@audit.invalid` } })
  const revoked = await db.user.create({ data: { email: `metric-revoked-${marker}@audit.invalid` } })
  const category = await db.category.create({ data: { name: `Проверка метрик ${marker}`, icon: "car" } })
  const listingFor = async (user, title, views) => {
    const car = await db.vehicle.create({ data: {
      make: "Toyota", model: "RAV4", year: 2024, price: 3100000, mileage: 18000,
      fuelType: "GASOLINE", transmission: "AUTOMATIC", condition: "EXCELLENT", location: "Москва", images: "[]",
      userId: user.id, categoryId: category.id,
      listings: { create: { userId: user.id, title, price: 3100000, status: "ACTIVE", views } },
    }, include: { listings: true } })
    return car.listings[0]
  }
  const listing = await listingFor(owner, "Проверка повторных публикаций", 11)
  const emptyListing = await listingFor(owner, "Продвижение без публикаций", 0)
  const foreignListing = await listingFor(other, "Чужое приватное продвижение", 999)
  const orderFor = (user, listing, overrides = {}) => db.promotionOrder.create({ data: {
    userId: user.id, listingId: listing.id, tariffId: "chats", amountRub: 300,
    durationDays: 30, status: "PAID", provider: "YOOKASSA", paidAt: new Date(),
    promoUntil: new Date(marker + 7 * 86400000),
    ...overrides,
  } })
  const order = await orderFor(owner, listing)
  const emptyOrder = await orderFor(owner, emptyListing)
  const foreignOrder = await orderFor(other, foreignListing)
  const duplicateOrder = await orderFor(owner, listing)
  const legacyListing = await listingFor(owner, "Старое активное продвижение", 0)
  await db.listing.update({ where: { id: legacyListing.id }, data: { promoUntil: new Date(marker + 7 * 86400000) } })
  const expiredListing = await listingFor(owner, "Истёкший тариф", 0)
  const expiredOrder = await orderFor(owner, expiredListing, { promoUntil: new Date(marker - 86400000) })
  const archivedListing = await listingFor(owner, "Снятое объявление", 0)
  await db.listing.update({ where: { id: archivedListing.id }, data: { status: "ARCHIVED" } })
  const archivedOrder = await orderFor(owner, archivedListing)
  const deletedListing = await listingFor(owner, "Удалённое объявление", 0)
  await db.listing.update({ where: { id: deletedListing.id }, data: { deletedAt: new Date() } })
  const deletedOrder = await orderFor(owner, deletedListing)
  const failedListing = await listingFor(owner, "Неоплаченный тариф", 0)
  const failedOrder = await orderFor(owner, failedListing, { status: "FAILED" })
  // Premium is replaced by a later Boost on the listing. Its historical paid
  // order must not revive the superseded placement after the Boost expires.
  const supersededListing = await listingFor(owner, "Премиум заменён истёкшим поднятием", 0)
  await db.listing.update({ where: { id: supersededListing.id }, data: {
    promoType: "boost", promoUntil: new Date(marker - 0.5 * 86400000), isFeatured: false,
  } })
  const supersededPremiumOrder = await orderFor(owner, supersededListing, {
    tariffId: "premium", durationDays: 7, paidAt: new Date(marker - 4 * 86400000),
    promoUntil: new Date(marker + 3 * 86400000),
  })
  const replacementBoostOrder = await orderFor(owner, supersededListing, {
    tariffId: "boost", durationDays: 3, paidAt: new Date(marker - 3.5 * 86400000),
    promoUntil: new Date(marker - 0.5 * 86400000),
  })
  const ownedOrders = [order, emptyOrder, duplicateOrder, expiredOrder, archivedOrder, deletedOrder, failedOrder, supersededPremiumOrder, replacementBoostOrder]
  const paidOrders = ownedOrders.filter((row) => row.status === "PAID")
  const firstChat = "-1000000001111", removedChat = "-1000000002222", foreignChat = "-1000000003333"
  await db.chatPromotionPost.createMany({ data: [
    { orderId: order.id, chatId: firstChat, messageId: 101 },
    { orderId: order.id, chatId: firstChat, messageId: 102 },
    { orderId: order.id, chatId: removedChat, messageId: 103, removedAt: new Date() },
    { orderId: foreignOrder.id, chatId: foreignChat, messageId: 201 },
  ] })
  const auth = await cookie(owner), otherAuth = await cookie(other), revokedAuth = await cookie(revoked)
  await db.user.update({ where: { id: revoked.id }, data: { sessionVersion: 1 } })
  const getStats = async (identity = "", suffix = "") => {
    const response = await fetch(`${base}/api/dashboard/stats${suffix}`, { headers: identity ? { Cookie: identity } : {} })
    return { status: response.status, body: await response.json() }
  }
  check("anonymous dashboard stats denied", (await getStats()).status === 401)
  check("revoked JWT dashboard stats denied without a server error", (await getStats(revokedAuth)).status === 401)
  const { status, body } = await getStats(auth)
  const visible = body.promotionOrders?.find((row) => row.id === order.id)
  const empty = body.promotionOrders?.find((row) => row.id === emptyOrder.id)
  check("owner can load promotion metrics", status === 200 && Boolean(visible))
  check("legacy unremoved publication count remains compatible", visible?._count?.chatPosts === 2)
  check("repeat posts remain two publications", visible?.chatPublicationCount === 2)
  check("repeat posts to one destination count one chat", visible?.chatCount === 1)
  check("removed destination contributes neither a publication nor a chat", visible?.chatCount === 1 && visible?.chatPublicationCount === 2)
  check("order without posts has explicit zero metrics", empty?.chatCount === 0 && empty?.chatPublicationCount === 0 && empty?._count?.chatPosts === 0)
  check("other owners' orders and listing data never appear", body.promotionOrders.length === ownedOrders.length && !JSON.stringify(body).includes(foreignOrder.id) && !JSON.stringify(body).includes(foreignListing.title))
  check("raw Telegram destination IDs never leave dashboard API", ![firstChat, removedChat, foreignChat].some((id) => JSON.stringify(body).includes(id)))
  check("publication metrics do not change owner listing views", body.stats.totalViews === 11)
  check("chat-only paid placement has no legacy listing expiry", listing.promoUntil === null && emptyListing.promoUntil === null)
  check("active placements count chat-only orders and legacy promotion once per active listing", body.stats.activePromotions === 3)
  check("duplicate paid renewals do not inflate active placement count", body.promotionOrders.filter((row) => row.listing.id === listing.id && row.status === "PAID").length === 2 && body.stats.activePromotions === 3)
  check("expired, failed, archived and deleted placements are excluded from active count", body.stats.activePromotions === 3 && paidOrders.length === 8)
  check("historical Premium order cannot revive a superseded expired Boost placement", body.stats.activePromotions === 3 && supersededPremiumOrder.promoUntil > new Date(marker) && replacementBoostOrder.promoUntil < new Date(marker))
  const foreign = await getStats(otherAuth)
  check("another owner receives only their own publication metrics", foreign.status === 200 && foreign.body.promotionOrders.length === 1 && foreign.body.promotionOrders[0].id === foreignOrder.id && foreign.body.promotionOrders[0].chatCount === 1 && foreign.body.promotionOrders[0].chatPublicationCount === 1)
  const summary = await getStats(auth, "?scope=summary")
  check("summary response omits order details but preserves paid counters", summary.status === 200 && summary.body.promotionOrders.length === 0 && summary.body.stats.promotionPaidCount === paidOrders.length && summary.body.stats.promotionSpentRub === paidOrders.reduce((sum, row) => sum + row.amountRub, 0) && summary.body.stats.activePromotions === 3)

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
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      isMobile: mobile, hasTouch: mobile, reducedMotion: "reduce", extraHTTPHeaders: { Cookie: auth },
    })
    await context.addInitScript(() => { localStorage.setItem("lw-quick-tour-v1", "done") })
    await context.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
    const page = await context.newPage(), errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${base}/dashboard?tab=payments`, { waitUntil: "networkidle" })
    await page.getByText("2 публикации в 1 чате", { exact: true }).waitFor()
    check(`${label}: repeats and destinations have accurate visible labels`, await page.getByText("2 публикации в 1 чате", { exact: true }).count() === 1)
    check(`${label}: no invented two-chat or audience label`, await page.getByText("Опубликовано в 2 чатах", { exact: true }).count() === 0)
    check(`${label}: payment history fits viewport`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    check(`${label}: no JavaScript runtime errors`, errors.length === 0)
    await page.screenshot({ path: `${output}/promotion-metrics-${label}.png`, fullPage: true })
    await context.close()
  }
  await writeFile(`${output}/report.json`, JSON.stringify({ mode: "isolated database and authenticated dashboard; no provider actions", checks, failures: [] }, null, 2))
  console.log(`PROMOTION_CHAT_METRICS_VERIFIED checks=${checks.length}`)
} finally { await browser?.close(); await db.$disconnect() }
