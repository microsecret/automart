// Server only. Real SQLite transactions on a disposable audit DB; no payment,
// Telegram, email or referral provider is contacted.
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import ts from "typescript"

const auditUrl = process.env.DATABASE_URL || ""
assert.match(auditUrl, /^file:\/tmp\/automart-auth-audit\.[\w-]+\/automart-audit\.db$/)
const db = new PrismaClient({ datasources: { db: { url: `${auditUrl}?connection_limit=1&socket_timeout=15` } } })
const key = `promotionAudit${crypto.randomBytes(10).toString("hex")}`
const referralCalls = []
globalThis[key] = { db, referralCalls }
const encode = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
const modules = new Map([
  ["src/lib/prisma.ts", encode(`export const prisma=globalThis[${JSON.stringify(key)}].db`)],
  ["src/lib/referral-accrual.ts", encode(`export async function accrueReferralReward(id){globalThis[${JSON.stringify(key)}].referralCalls.push(id)}`)],
])

async function load(relative) {
  if (modules.has(relative)) return modules.get(relative)
  let source = await readFile(path.resolve(relative), "utf8")
  for (const match of [...source.matchAll(/from\s+(["'])(@\/lib\/[^"']+)\1/g)]) {
    source = source.replaceAll(match[1] + match[2] + match[1], JSON.stringify(await load(`src/${match[2].slice(2)}.ts`)))
  }
  const url = encode(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText)
  modules.set(relative, url)
  return url
}

const checks = []
function check(name, condition) {
  assert.ok(condition, name)
  checks.push(name)
  console.log(`PASS ${name}`)
}
const DAY = 86400000
const paymentCreatedAt = new Date("2026-11-03T10:00:00Z")
const expiry = new Date(+paymentCreatedAt + 5 * DAY)
const marker = `promotion-audit-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`
let sequence = 0

try {
  const { activatePaidPromotion } = await import(await load("src/lib/promotion-activation.ts"))
  const { PROMOTION_TARIFFS } = await import(await load("src/lib/promotion-tariffs.ts"))
  const { BOOST, PREMIUM, CHATS, CHATS_DAILY, CHATS_THRICE } = PROMOTION_TARIFFS
  check("legacy chats tariff keeps original paid order price and duration", CHATS.id === "chats" && CHATS.amountRub === 300 && CHATS.durationDays === 30)

  async function fixture(promotion = {}, status = "ACTIVE") {
    const suffix = `${marker}-${++sequence}`
    const user = await db.user.create({ data: { email: `${suffix}@audit.invalid`, name: "Аудит оплаченного продвижения" } })
    const category = await db.category.create({ data: { name: suffix, icon: "car" } })
    const vehicle = await db.vehicle.create({ data: {
      make: "Toyota", model: "RAV4", year: 2024, price: 1000000, mileage: 18000,
      fuelType: "GASOLINE", transmission: "AUTOMATIC", bodyType: "SUV", color: "Белый",
      power: 199, engineVolume: 2, driveType: "AWD", condition: "EXCELLENT", location: "Москва",
      vehicleType: "CAR", steeringWheel: "LEFT", ownersCount: 1, documentsStatus: "CLEAN",
      damageInfo: "NONE", sellerType: "OWNER", availability: "IN_STOCK", customsCleared: true,
      description: "Проверка активации без реального платежа", images: "[]", userId: user.id, categoryId: category.id,
      listings: { create: { title: suffix, price: 1000000, status, userId: user.id, ...promotion } },
    }, include: { listings: true } })
    return { user, listing: vehicle.listings[0] }
  }
  async function orderFor(subject, tariff, data = {}) {
    return db.promotionOrder.create({ data: {
      listingId: subject.listing.id, userId: subject.user.id, tariffId: tariff.id,
      amountRub: tariff.amountRub, durationDays: tariff.durationDays, provider: "YOOKASSA", ...data,
    } })
  }
  function payment(subject, tariff, order) {
    return {
      orderId: order.id, listingId: subject.listing.id, userId: subject.user.id,
      tariff, providerPaymentId: `isolated-${order.id}`, paymentCreatedAt,
    }
  }

  const website = await fixture({ promoType: BOOST.id, promoUntil: expiry, isFeatured: false })
  const websiteOrders = await Promise.all([orderFor(website, BOOST), orderFor(website, BOOST)])
  const websiteResults = await Promise.all(websiteOrders.map((order) => activatePaidPromotion(payment(website, BOOST, order))))
  check("two distinct concurrent website payments both activate", websiteResults.every((result) => result === "activated"))
  const renewedWebsite = await db.listing.findUniqueOrThrow({ where: { id: website.listing.id } })
  check("concurrent website renewals retain both purchased terms", +renewedWebsite.promoUntil === +expiry + 2 * BOOST.durationDays * DAY)
  const webEntitlements = await db.promotionOrder.findMany({ where: { id: { in: websiteOrders.map((order) => order.id) } }, orderBy: { promoUntil: "asc" } })
  check("website order expiry snapshots form consecutive paid terms", +webEntitlements[0].promoUntil === +expiry + BOOST.durationDays * DAY && +webEntitlements[1].promoUntil === +expiry + 2 * BOOST.durationDays * DAY)
  const callsBeforeRepeat = referralCalls.length
  check("repeated provider callback remains idempotent", await activatePaidPromotion(payment(website, BOOST, websiteOrders[0])) === "already_active")
  check("repeat does not extend website expiry or accrue reward twice", +(await db.listing.findUniqueOrThrow({ where: { id: website.listing.id } })).promoUntil === +renewedWebsite.promoUntil && referralCalls.length === callsBeforeRepeat)

  const sameOrder = await orderFor(website, BOOST)
  const sameOrderResults = await Promise.all([activatePaidPromotion(payment(website, BOOST, sameOrder)), activatePaidPromotion(payment(website, BOOST, sameOrder))])
  check("concurrent duplicate callbacks activate only once", sameOrderResults.filter((result) => result === "activated").length === 1 && sameOrderResults.filter((result) => result === "already_active").length === 1)
  check("concurrent duplicate contributes one purchased term", +(await db.listing.findUniqueOrThrow({ where: { id: website.listing.id } })).promoUntil === +renewedWebsite.promoUntil + BOOST.durationDays * DAY)

  const premiumExpiry = new Date(+paymentCreatedAt + 12 * DAY)
  const chats = await fixture({ promoType: PREMIUM.id, promoUntil: premiumExpiry, isFeatured: true })
  const legacy = await orderFor(chats, CHATS, {
    status: "PAID", promoUntil: expiry, paidAt: new Date(+paymentCreatedAt - DAY), providerPaymentId: `${marker}-legacy`,
  })
  const legacySnapshot = JSON.stringify(legacy)
  const chatOrders = await Promise.all([orderFor(chats, CHATS), orderFor(chats, CHATS)])
  check("two distinct concurrent chat renewals activate", (await Promise.all(chatOrders.map((order) => activatePaidPromotion(payment(chats, CHATS, order))))).every((result) => result === "activated"))
  const renewedChats = await db.promotionOrder.findMany({ where: { id: { in: chatOrders.map((order) => order.id) } }, orderBy: { promoUntil: "asc" } })
  check("chat renewal uses previous paid chat expiry and retains both terms", +renewedChats[0].promoUntil === +expiry + CHATS.durationDays * DAY && +renewedChats[1].promoUntil === +expiry + 2 * CHATS.durationDays * DAY)
  const preservedPremium = await db.listing.findUniqueOrThrow({ where: { id: chats.listing.id } })
  check("chat payments preserve active website badge and expiry", preservedPremium.isFeatured === true && preservedPremium.promoType === PREMIUM.id && +preservedPremium.promoUntil === +premiumExpiry)
  check("legacy paid chat order stays byte-for-byte unchanged", JSON.stringify(await db.promotionOrder.findUniqueOrThrow({ where: { id: legacy.id } })) === legacySnapshot)

  const chatOnly = await fixture()
  const firstChatOrder = await orderFor(chatOnly, CHATS)
  check("first chat-only order activates without a website promotion", await activatePaidPromotion(payment(chatOnly, CHATS, firstChatOrder)) === "activated")
  const chatOnlyListing = await db.listing.findUniqueOrThrow({ where: { id: chatOnly.listing.id } })
  check("chat-only order leaves website placement fields unchanged", chatOnlyListing.promoType === null && chatOnlyListing.promoUntil === null && chatOnlyListing.isFeatured === false)
  check("first chat order retains provider creation-time anchor", +(await db.promotionOrder.findUniqueOrThrow({ where: { id: firstChatOrder.id } })).promoUntil === +paymentCreatedAt + CHATS.durationDays * DAY)

  const weekly = await fixture()
  const daily = await orderFor(weekly, CHATS_DAILY)
  const beforeActivation = Date.now()
  check("new daily term activates from confirmed payment processing", await activatePaidPromotion(payment(weekly, CHATS_DAILY, daily)) === "activated")
  const dailyEnd = +(await db.promotionOrder.findUniqueOrThrow({ where: { id: daily.id } })).promoUntil
  check("first weekly term starts at activation instead of checkout creation", dailyEnd >= beforeActivation + 7 * DAY && dailyEnd <= Date.now() + 7 * DAY)
  const thrice = await orderFor(weekly, CHATS_THRICE)
  check("changing frequency buys a consecutive weekly term", await activatePaidPromotion(payment(weekly, CHATS_THRICE, thrice)) === "activated")
  check("new frequency starts after the already paid term", +(await db.promotionOrder.findUniqueOrThrow({ where: { id: thrice.id } })).promoUntil === dailyEnd + 7 * DAY)

  const inactive = await fixture({}, "PAUSED")
  const inactiveOrder = await orderFor(inactive, CHATS)
  const callsBeforeInactive = referralCalls.length
  check("payment for inactive listing is routed to review", await activatePaidPromotion(payment(inactive, CHATS, inactiveOrder)) === "listing_inactive")
  const reviewOrder = await db.promotionOrder.findUniqueOrThrow({ where: { id: inactiveOrder.id } })
  check("review retains confirmed payment details", reviewOrder.status === "REVIEW_REQUIRED" && reviewOrder.providerPaymentId === `isolated-${inactiveOrder.id}` && reviewOrder.paidAt !== null)
  check("inactive listing gets warning without referral accrual", await db.notification.count({ where: { userId: inactive.user.id, title: "Платёж требует проверки" } }) === 1 && referralCalls.length === callsBeforeInactive)

  for (const [label, mutation] of [
    ["soft-deleted", { deletedAt: new Date() }],
    ["ownership changed after checkout", { userId: website.user.id }],
  ]) {
    const subject = await fixture()
    const order = await orderFor(subject, BOOST)
    await db.listing.update({ where: { id: subject.listing.id }, data: mutation })
    check(`${label} listing cannot receive paid placement`, await activatePaidPromotion(payment(subject, BOOST, order)) === "listing_inactive")
    const stored = await db.promotionOrder.findUniqueOrThrow({ where: { id: order.id } })
    check(`${label} payment remains available for support review`, stored.status === "REVIEW_REQUIRED" && stored.providerPaymentId === `isolated-${order.id}`)
    check(`${label} listing placement stays untouched`, (await db.listing.findUniqueOrThrow({ where: { id: subject.listing.id } })).promoType === null)
  }

  console.log(`PROMOTION_ACTIVATION_VERIFIED checks=${checks.length}`)
} finally {
  delete globalThis[key]
  await db.$disconnect()
}
