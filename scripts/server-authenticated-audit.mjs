#!/usr/bin/env node

import crypto from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"
import bcrypt from "bcryptjs"

const baseUrl = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4011"
const databaseUrl = process.env.DATABASE_URL || ""

if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(baseUrl)) {
  throw new Error("Authenticated audit is restricted to a local isolated server")
}
if (!databaseUrl.toLowerCase().includes("audit")) {
  throw new Error("Authenticated audit requires a disposable database containing 'audit' in its name")
}
if (!process.env.NEXTAUTH_SECRET) throw new Error("NEXTAUTH_SECRET is required")

const prisma = new PrismaClient()
const marker = `server-audit-${Date.now()}`
const results = []

function record(label, ok, detail = "") {
  results.push({ label, ok, detail })
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`)
  if (!ok) throw new Error(`${label}: ${detail}`)
}

async function responseJson(response) {
  const text = await response.text()
  try { return text ? JSON.parse(text) : null } catch { return { raw: text.slice(0, 500) } }
}

async function request(path, cookie, options = {}) {
  const headers = new Headers(options.headers || {})
  if (cookie) headers.set("Cookie", cookie)
  if (options.body && !headers.has("Content-Type") && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json")
  return fetch(`${baseUrl}${path}`, { ...options, headers })
}

async function expect(path, cookie, status, options = {}) {
  const response = await request(path, cookie, options)
  const body = await responseJson(response)
  record(`${options.method || "GET"} ${path}`, response.status === status, `HTTP ${response.status}`)
  return body
}

async function expectOneOf(path, cookie, statuses, options = {}) {
  const response = await request(path, cookie, options)
  const body = await responseJson(response)
  record(`${options.method || "GET"} ${path}`, statuses.includes(response.status), `HTTP ${response.status}`)
  return { body, response }
}

async function sessionCookie(user) {
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 60 * 60,
    token: { id: user.id, sub: user.id, email: user.email, name: user.name, role: user.role },
  })
  return `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
}

async function run() {
  const auditPasswordHash = await bcrypt.hash("AuditPass-2026", 4)
  const category = await prisma.category.upsert({
    where: { name: "Легковые" },
    update: {},
    create: { name: "Легковые", description: "Изолированная серверная проверка", icon: "car" },
  })
  const primary = await prisma.user.create({
    data: { email: `${marker}-buyer@audit.lewheel.invalid`, phone: `+7997${String(Date.now()).slice(-7)}`, name: "Покупатель Аудит", role: "USER", emailVerified: new Date(), hashedPassword: auditPasswordHash },
  })
  const seller = await prisma.user.create({
    data: { email: `${marker}-seller@audit.lewheel.invalid`, phone: `+7996${String(Date.now()).slice(-7)}`, name: "Продавец Аудит", role: "USER", emailVerified: new Date() },
  })
  const administrator = await prisma.user.create({
    data: { email: `${marker}-admin@audit.lewheel.invalid`, name: "Администратор Аудит", role: "ADMIN", emailVerified: new Date() },
  })
  const revocableAdministrator = await prisma.user.create({
    data: { email: `${marker}-revocable-admin@audit.lewheel.invalid`, name: "Отзываемый администратор", role: "ADMIN", emailVerified: new Date() },
  })
  const removableUser = await prisma.user.create({
    data: { email: `${marker}-removable@audit.lewheel.invalid`, name: "Удаляемый пользователь", role: "USER", emailVerified: new Date() },
  })
  const sellerVehicle = await prisma.vehicle.create({
    data: {
      make: "Toyota", model: "RAV4", year: 2024, price: 3_100_000, mileage: 18_000,
      vin: `LWSELLER${String(Date.now()).slice(-9)}`.slice(0, 17), fuelType: "GASOLINE",
      transmission: "AUTOMATIC", bodyType: "SUV", color: "Белый", power: 199, engineVolume: 2,
      driveType: "AWD", condition: "EXCELLENT", location: "Москва", vehicleType: "CAR",
      steeringWheel: "LEFT", ownersCount: 1, documentsStatus: "CLEAN", damageInfo: "NONE",
      sellerType: "OWNER", availability: "IN_STOCK", customsCleared: true, generation: "V (XA50)",
      description: "Полная карточка продавца для проверки публичного каталога и контактов.",
      images: JSON.stringify(["https://images.unsplash.com/photo-1549317661-bd32c8ce0db2"]),
      userId: seller.id, categoryId: category.id,
      listings: { create: { title: `${marker} Toyota RAV4`, price: 3_100_000, status: "ACTIVE", userId: seller.id } },
    },
    include: { listings: true },
  })
  const publicListingId = sellerVehicle.listings[0].id
  const legacyVehicle = await prisma.vehicle.create({
    data: {
      make: "Opel", model: "Vivaro", year: 2022, price: 2_300_000, mileage: 104_000,
      fuelType: "DIESEL", transmission: "MANUAL", condition: "GOOD", location: "Москва",
      vehicleType: "CAR", description: "Старая неполная карточка до введения строгого контракта.",
      images: JSON.stringify(["https://images.unsplash.com/photo-1549317661-bd32c8ce0db2"]),
      userId: seller.id, categoryId: category.id,
      listings: {
        create: {
          title: `${marker} legacy Opel Vivaro`, price: 2_300_000, status: "ACTIVE",
          publishedAt: new Date(), userId: seller.id,
        },
      },
    },
    include: { listings: true },
  })
  const legacyListingId = legacyVehicle.listings[0].id
  const auctionListing = await prisma.auctionListing.create({
    data: {
      sourceId: `${marker}-encar-lot`, source: "ENCAR", sourceUrl: `https://www.encar.com/${marker}`,
      make: "Hyundai", model: "Tucson", year: new Date().getFullYear(), mileage: 12_000,
      sourcePrice: 25_000_000, sourceCurrency: "KRW", priceRub: 1_500_000, markup: 200_000,
      finalPrice: 1_700_000, country: "KR", status: "ACTIVE", sourceLastSeenAt: new Date(),
      fuelType: "DIESEL", transmission: "AUTOMATIC", bodyType: "SUV", color: "Белый",
      driveType: "AWD", imageUrl: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2",
      engineVolume: 1998, power: 180, lotNumber: `${marker}-lot-1`, location: "Сеул",
      specsRu: "Количество ключей: 2\nЭкологический стандарт: Евро-6",
      conditionInfo: JSON.stringify({ damageReport: { sections: [] }, inspectionNotes: [] }),
    },
  })
  const similarAuctionListing = await prisma.auctionListing.create({
    data: {
      sourceId: `${marker}-kcar-similar`, source: "KCAR", sourceUrl: `https://www.kcar.com/${marker}-similar`,
      make: "Hyundai", model: "Santa Fe", year: new Date().getFullYear(), mileage: 15_000,
      sourcePrice: 36_000_000, sourceCurrency: "KRW", priceRub: 2_300_000, markup: 200_000,
      finalPrice: 2_500_000, country: "KR", status: "ACTIVE", sourceLastSeenAt: new Date(),
    },
  })
  const staleAuctionListing = await prisma.auctionListing.create({
    data: {
      sourceId: `${marker}-stale-encar-lot`, source: "ENCAR", sourceUrl: `https://www.encar.com/${marker}-stale`,
      make: "Hyundai", model: "Stale audit lot", year: new Date().getFullYear(), mileage: 22_000,
      sourcePrice: 22_000_000, sourceCurrency: "KRW", priceRub: 1_300_000, markup: 200_000,
      finalPrice: 1_500_000, country: "KR", status: "ACTIVE", sourceLastSeenAt: new Date(Date.now() - 48 * 60 * 60_000),
    },
  })
  await prisma.auctionListing.create({
    data: {
      sourceId: `${marker}-quality-hold`, source: "ENCAR", sourceUrl: `https://www.encar.com/${marker}-quality-hold`,
      make: "Hyundai", model: "Quality hold audit lot", year: new Date().getFullYear(), mileage: 10_000,
      sourcePrice: 1, sourceCurrency: "KRW", priceRub: 1, markup: 0, finalPrice: 1,
      country: "KR", status: "POLICY_EXCLUDED", sourceLastSeenAt: new Date(), adminHiddenAt: new Date(),
      adminHiddenReason: "Автопроверка качества: цена источника недостоверна",
    },
  })
  const syncNow = Date.now()
  await prisma.auctionSyncRun.createMany({
    data: [
      {
        source: "ENCAR", syncKind: "DISCOVERY", status: "SUCCEEDED", requestedLimit: 5,
        startedAt: new Date(syncNow - 45 * 60_000), completedAt: new Date(syncNow - 44 * 60_000),
      },
      {
        source: "ENCAR", syncKind: "REFRESH", status: "PARTIAL", requestedLimit: 40, failed: 1,
        error: "Одна карточка источника недоступна", startedAt: new Date(syncNow - 20 * 60_000), completedAt: new Date(syncNow - 18 * 60_000),
      },
      {
        source: "ENCAR", syncKind: "DISCOVERY", status: "FAILED", requestedLimit: 5, failed: 1,
        error: "Контрольный таймаут источника", startedAt: new Date(syncNow - 5 * 60_000), completedAt: new Date(syncNow - 4 * 60_000),
      },
      {
        source: "KCAR", syncKind: "REFRESH", status: "RUNNING", requestedLimit: 40,
        startedAt: new Date(syncNow - 20 * 60_000),
      },
    ],
  })
  const cookie = await sessionCookie(primary)
  const sellerCookie = await sessionCookie(seller)
  const adminCookie = await sessionCookie(administrator)
  const revocableAdminCookie = await sessionCookie(revocableAdministrator)
  const removableUserCookie = await sessionCookie(removableUser)

  const registrationEmail = `${marker}-web@audit.lewheel.invalid`
  const registrationPhone = `+7998${String(Date.now()).slice(-7)}`
  const registration = await expect("/api/auth/register", null, 410, {
    method: "POST",
    body: JSON.stringify({ name: "Веб Регистрация", email: registrationEmail, phone: registrationPhone, password: "AuditPass-2026" }),
  })
  const registeredUser = await prisma.user.findUnique({ where: { email: registrationEmail } })
  record(
    "web registration is closed in favor of the Telegram onboarding flow",
    registration?.error === "Регистрация доступна только через Telegram-бота" && registeredUser === null,
    registration?.registrationUrl || "bot link unavailable",
  )
  await expect("/api/auth/telegram", null, 400, { method: "POST", body: "{" })
  const auditTelegramId = String(Date.now())
  await prisma.user.update({
    where: { id: primary.id },
    data: { telegramId: auditTelegramId, telegramVerifiedAt: new Date() },
  })
  const telegramParams = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1_000)),
    query_id: marker,
    user: JSON.stringify({ id: auditTelegramId, first_name: "Покупатель", username: "lewheel_audit" }),
  })
  const telegramCheckString = Array.from(telegramParams.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
  const telegramSecret = crypto.createHmac("sha256", "WebAppData").update(process.env.TELEGRAM_BOT_TOKEN).digest()
  telegramParams.set("hash", crypto.createHmac("sha256", telegramSecret).update(telegramCheckString).digest("hex"))
  const telegramSession = await expect("/api/auth/telegram", null, 200, {
    method: "POST",
    body: JSON.stringify({ initData: telegramParams.toString() }),
  })
  record("signed Telegram Mini App identity resolves the verified account", telegramSession?.user?.id === primary.id, telegramSession?.user?.id || "missing")
  const repeatedTelegramSession = await expect("/api/auth/telegram", null, 200, {
    method: "POST",
    body: JSON.stringify({ initData: telegramParams.toString() }),
  })
  const telegramLinkedAccounts = await prisma.user.count({ where: { telegramId: auditTelegramId } })
  record(
    "reopening Telegram Mini App reuses the account without duplicates",
    repeatedTelegramSession?.user?.id === primary.id && telegramLinkedAccounts === 1,
    `${repeatedTelegramSession?.user?.id || "missing"} · ${telegramLinkedAccounts} linked account(s)`,
  )
  await expect("/api/auth/resend-verification", null, 400, { method: "POST", body: "{" })
  await expect("/api/auth/telegram/request-code", null, 410, { method: "POST", body: JSON.stringify({ phone: "123" }) })
  await expect("/api/auth/telegram/verify-code", null, 410, { method: "POST", body: JSON.stringify({ phone: registrationPhone }) })
  await expect("/api/auth/verify-email?token=invalid-audit-token", null, 307, { redirect: "manual" })

  const brands = await expect("/api/v1/brands?category=CAR", null, 200)
  record("brand directory exposes a production catalog", brands?.total > 20 && brands?.brands?.some((brand) => brand.name === "Toyota"), `${brands?.total ?? 0} brands`)
  const brandModels = await expect("/api/v1/brands/Toyota/models?category=CAR", null, 200)
  record("brand model cascade exposes Toyota models", brandModels?.models?.length > 0, `${brandModels?.models?.length ?? 0} models`)
  await expect("/api/v1/models?brand_id=Toyota&category=CAR", null, 200)
  await expect("/api/categories", null, 200)
  await expect("/api/stats", null, 200)
  const exchangeRateTimestamp = new Date()
  const exchangeRateFixtures = [
    { currency: "USD", rateToRub: 80 },
    { currency: "EUR", rateToRub: 92 },
    { currency: "JPY", rateToRub: 0.54 },
    { currency: "KRW", rateToRub: 0.058 },
    { currency: "CNY", rateToRub: 11.1 },
  ]
  await prisma.$transaction(exchangeRateFixtures.map(({ currency, rateToRub }) => prisma.exchangeRate.upsert({
    where: { currency },
    create: { currency, rateToRub, source: "AUDIT_FIXTURE", effectiveAt: exchangeRateTimestamp },
    update: { rateToRub, source: "AUDIT_FIXTURE", effectiveAt: exchangeRateTimestamp },
  })))
  const exchangeRates = await expect("/api/exchange-rates", null, 200)
  record("exchange-rate service exposes dated official rates", exchangeRates?.updated === true && typeof exchangeRates?.asOf === "string", exchangeRates?.asOf || "missing")
  await expect("/api/fuel-stations?latitude=0&longitude=0", null, 400)
  await expect("/api/payment/create-intent", cookie, 410, { method: "POST" })
  await expectOneOf("/api/payment/webhook", null, [400, 503], { method: "POST", body: "{}" })
  await expect("/api/analytics/visit", cookie, 204, {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.42", "user-agent": "Mozilla/5.0 (iPhone) LeWheel isolated audit" },
    body: JSON.stringify({ path: "/audit/functional", visitorKey: marker, sessionKey: marker, utmSource: "telegram", campaign: "production-audit" }),
  })
  await expect("/api/analytics/visit", cookie, 204, {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.42", "user-agent": "Mozilla/5.0 (iPhone) LeWheel isolated audit" },
    body: JSON.stringify({ path: "/audit/functional", visitorKey: marker, sessionKey: marker, utmSource: "telegram" }),
  })
  await expect("/api/analytics/visit", null, 204, {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.43", "user-agent": "Googlebot/2.1" },
    body: JSON.stringify({ path: "/audit/bot", visitorKey: `${marker}-bot`, sessionKey: `${marker}-bot` }),
  })
  const visit = await prisma.visitEvent.findFirst({ where: { sessionKey: marker } })
  const duplicateVisits = await prisma.visitEvent.count({ where: { sessionKey: marker, path: "/audit/functional" } })
  const botVisits = await prisma.visitEvent.count({ where: { path: "/audit/bot" } })
  record("analytics stores only a salted IP hash", Boolean(visit?.ipHash && visit.ipHash !== "203.0.113.42" && visit.userId === primary.id), visit?.id || "missing")
  record("analytics records visitor, session, device and acquisition dimensions", visit?.visitorKey === marker && visit?.deviceType === "MOBILE" && visit?.trafficSource === "UTM:TELEGRAM" && visit?.campaign === "production-audit", `${visit?.deviceType || "missing"} · ${visit?.trafficSource || "missing"}`)
  record("analytics deduplicates retries and ignores bots", duplicateVisits === 1 && botVisits === 0, `${duplicateVisits} page view · ${botVisits} bot events`)

  await prisma.news.createMany({
    data: [
      { title: `${marker} небольшой интерес`, content: "Изолированная новость", views: 5, publishedAt: new Date(Date.now() - 60_000) },
      { title: `${marker} лидер просмотров`, content: "Изолированная новость", views: 100, publishedAt: new Date(Date.now() - 120_000) },
      { title: `${marker} средний интерес`, content: "Изолированная новость", views: 20, publishedAt: new Date(Date.now() - 180_000) },
    ],
  })

  await expect("/api/dashboard/stats", cookie, 200)
  const adminStats = await expect("/api/admin/stats", adminCookie, 200)
  record("admin dashboard exposes real support counters", Number.isSafeInteger(adminStats?.operations?.openSupportTickets) && Number.isSafeInteger(adminStats?.counts?.supportTickets), `${adminStats?.operations?.openSupportTickets ?? "missing"} open`)
  record("admin dashboard separates views, visitors, sessions and authenticated users", adminStats?.traffic?.pageViewsWeek >= 1 && adminStats?.traffic?.uniqueVisitorsWeek >= 1 && adminStats?.traffic?.sessionsWeek >= 1 && adminStats?.traffic?.authenticatedVisitorsWeek >= 1 && adminStats?.traffic?.attributedRegistrationsWeek >= 0 && adminStats?.traffic?.registrationConversionWeek <= 100 && adminStats?.traffic?.devices?.some((item) => item.key === "MOBILE") && adminStats?.traffic?.sources?.some((item) => item.key === "UTM:TELEGRAM"), `${adminStats?.traffic?.pageViewsWeek ?? 0} views · ${adminStats?.traffic?.uniqueVisitorsWeek ?? 0} visitors · ${adminStats?.traffic?.registrationConversionWeek ?? 0}% conversion`)
  record("source transport reports a valid bounded TCP pool", adminStats?.sourceTransport?.configurationValid === true && adminStats?.sourceTransport?.active + adminStats?.sourceTransport?.quarantined === adminStats?.sourceTransport?.configured && adminStats?.sourceTransport?.maxConnectionsPerProxy >= 1 && adminStats?.sourceTransport?.maxConnectionsPerProxy <= 50 && adminStats?.sourceTransport?.hardLimit === 50, `${adminStats?.sourceTransport?.active ?? 0}/${adminStats?.sourceTransport?.configured ?? 0} active · cap ${adminStats?.sourceTransport?.maxConnectionsPerProxy ?? "missing"}`)
  const encarFieldMatrix = adminStats?.sourceFieldMatrix?.find((source) => source.source === "ENCAR")
  record(
    "source field matrix measures only current public lots and keeps quality quarantine separate",
    encarFieldMatrix?.total === 2
      && encarFieldMatrix?.quarantined === 1
      && Number.isInteger(encarFieldMatrix?.completenessPercent)
      && encarFieldMatrix?.fields?.every((field) => field.filled <= encarFieldMatrix.total && field.missing === encarFieldMatrix.total - field.filled),
    encarFieldMatrix ? `${encarFieldMatrix.total} public · ${encarFieldMatrix.quarantined} held · ${encarFieldMatrix.completenessPercent}% complete` : "ENCAR missing",
  )
  await prisma.user.update({ where: { id: revocableAdministrator.id }, data: { role: "USER" } })
  await expect("/api/admin/stats", revocableAdminCookie, 403)
  record("administrator role revocation takes effect on the next request", true, revocableAdministrator.id)
  await prisma.user.delete({ where: { id: removableUser.id } })
  await expect("/api/vehicles", removableUserCookie, 401)
  record("deleted account cannot keep using its signed session", true, removableUser.id)
  await expect("/api/admin/support", adminCookie, 200)
  const supportCountBeforeInvalid = await prisma.supportTicket.count()
  await expect("/api/support/chat", null, 400, { method: "POST", body: JSON.stringify({ action: "MESSAGE", message: "" }) })
  const supportCountAfterInvalid = await prisma.supportTicket.count()
  record("invalid guest support input creates no empty ticket", supportCountBeforeInvalid === supportCountAfterInvalid, `${supportCountBeforeInvalid} then ${supportCountAfterInvalid}`)
  const guestSupportResponse = await request("/api/support/chat", null, {
    method: "POST",
    body: JSON.stringify({ action: "MESSAGE", message: "Как зарегистрироваться на сайте?" }),
  })
  const guestSupport = await responseJson(guestSupportResponse)
  const guestSupportCookie = guestSupportResponse.headers.get("set-cookie")?.split(";", 1)[0] || ""
  record("guest support creates a persistent ticket with knowledge answer", guestSupportResponse.status === 200 && Boolean(guestSupport?.ticket?.id && guestSupport?.messages?.some((message) => message.authorType === "AI") && guestSupportCookie), `HTTP ${guestSupportResponse.status}`)
  await expect("/api/support/chat", guestSupportCookie, 200, {
    method: "POST",
    body: JSON.stringify({ action: "UPDATE_CONTACT", name: "Гость Аудита", email: `${marker}@guest.lewheel.invalid` }),
  })
  await expect("/api/support/chat", guestSupportCookie, 200, {
    method: "POST",
    body: JSON.stringify({ action: "UPDATE_CONTACT", phone: "+7 999 123-45-67" }),
  })
  const supportContact = await prisma.supportTicket.findUnique({ where: { id: guestSupport.ticket.id } })
  record(
    "partial guest contact updates preserve previously collected fields",
    supportContact?.guestName === "Гость Аудита" && supportContact?.guestEmail === `${marker}@guest.lewheel.invalid` && supportContact?.guestPhone === "79991234567",
    `${supportContact?.guestName || "no name"} · ${supportContact?.guestPhone || "no phone"}`,
  )
  const operatorSupport = await expect("/api/support/chat", guestSupportCookie, 200, { method: "POST", body: JSON.stringify({ action: "REQUEST_OPERATOR" }) })
  record("guest support hands conversation to operator queue", operatorSupport?.ticket?.status === "WAITING_OPERATOR" && operatorSupport?.ticket?.mode === "OPERATOR", operatorSupport?.ticket?.status || "missing")
  const supportQueue = await expect("/api/admin/support?status=WAITING_OPERATOR", adminCookie, 200)
  record("admin support queue receives guest handoff", supportQueue?.tickets?.some((ticket) => ticket.id === guestSupport.ticket.id), `${supportQueue?.tickets?.length ?? 0} waiting`)
  await expect(`/api/admin/support/${guestSupport.ticket.id}`, adminCookie, 200)
  const takenTicket = await expect(`/api/admin/support/${guestSupport.ticket.id}`, adminCookie, 200, {
    method: "PATCH",
    body: JSON.stringify({ action: "TAKE_OVER" }),
  })
  record("operator can take ownership of a guest conversation", takenTicket?.ticket?.assignedToId === administrator.id && takenTicket?.ticket?.status === "IN_PROGRESS", takenTicket?.ticket?.status || "missing")
  const operatorReply = await expect(`/api/admin/support/${guestSupport.ticket.id}`, adminCookie, 200, {
    method: "POST",
    body: JSON.stringify({ message: "Оператор подключился. Помогу пройти регистрацию по шагам." }),
  })
  record("operator reply is persisted in the shared transcript", operatorReply?.ticket?.messages?.some((message) => message.authorType === "OPERATOR"), `${operatorReply?.ticket?.messages?.length ?? 0} messages`)
  const guestTranscript = await expect("/api/support/chat", guestSupportCookie, 200)
  record("anonymous visitor receives the operator reply with the guest cookie", guestTranscript?.messages?.some((message) => message.authorType === "OPERATOR"), `${guestTranscript?.messages?.length ?? 0} messages`)
  const closedTicket = await expect(`/api/admin/support/${guestSupport.ticket.id}`, adminCookie, 200, {
    method: "PATCH",
    body: JSON.stringify({ action: "CLOSE" }),
  })
  record("operator can close the ticket with an audit event", closedTicket?.ticket?.status === "CLOSED" && Boolean(closedTicket?.ticket?.closedAt), closedTicket?.ticket?.status || "missing")
  const supportAudit = await expect(`/api/admin/audit?action=SUPPORT_TICKET_UPDATE&entityType=SupportTicket&q=${guestSupport.ticket.id}`, adminCookie, 200)
  record(
    "support ownership and status decisions appear in the central admin audit",
    supportAudit?.events?.some((event) => event.entityId === guestSupport.ticket.id && event.actor?.id === administrator.id),
    `${supportAudit?.events?.length ?? 0} event(s)`,
  )
  const popularNews = await expect(`/api/news?sort=popular&q=${encodeURIComponent(marker)}&limit=3`, null, 200)
  record("popular news is ordered by real view count", popularNews?.news?.map((item) => item.views).join(",") === "100,20,5", popularNews?.news?.map((item) => item.views).join(",") || "missing")
  const viewedNews = await prisma.news.findFirstOrThrow({ where: { title: `${marker} небольшой интерес` }, select: { id: true } })
  const newsViewOne = await expect(`/api/news/${viewedNews.id}`, null, 200)
  const newsViewTwo = await expect(`/api/news/${viewedNews.id}`, `news-view-${viewedNews.id}=1`, 200)
  record("news views are unique within the hourly window", newsViewOne?.views === newsViewTwo?.views, `${newsViewOne?.views} then ${newsViewTwo?.views}`)
  await expect(`/api/auctions/${auctionListing.id}/inquiry`, null, 401, {
    method: "POST",
    body: JSON.stringify({ name: "Покупатель Аудит", phone: primary.phone, email: primary.email, city: "Москва", comment: "Нужен расчёт доставки" }),
  })
  record("anonymous auction inquiry cannot bypass the protected deal workspace", true, "HTTP 401")
  const auctionStats = await expect("/api/admin/auctions/stats", adminCookie, 200)
  const encarHealth = auctionStats?.sourceHealth?.find((source) => source.source === "ENCAR")
  record(
    "source health separates fresh, stale, removal and quality states",
    encarHealth?.fresh >= 1 && encarHealth?.stale >= 1 && encarHealth?.qualityHold >= 1 && encarHealth?.expectedRefreshHours === 4,
    encarHealth ? `${encarHealth.fresh} fresh · ${encarHealth.stale} stale · ${encarHealth.qualityHold} held` : "ENCAR missing",
  )
  record(
    "source health exposes the latest failure, duration and consecutive issue series",
    encarHealth?.operationalStatus === "FAILED"
      && encarHealth?.consecutiveIssues === 2
      && encarHealth?.latestRunDurationSeconds === 60
      && encarHealth?.latestRunError === "Контрольный таймаут источника",
    encarHealth ? `${encarHealth.operationalStatus} · ${encarHealth.consecutiveIssues} issue(s)` : "ENCAR missing",
  )
  const kcarHealth = auctionStats?.sourceHealth?.find((source) => source.source === "KCAR")
  record(
    "source health marks an abandoned running parser as stuck",
    kcarHealth?.operationalStatus === "STUCK" && kcarHealth?.latestRunDurationSeconds >= 20 * 60,
    kcarHealth ? `${kcarHealth.operationalStatus} · ${kcarHealth.latestRunDurationSeconds}s` : "KCAR missing",
  )
  const highlightPath = `/api/admin/telegram-auction-highlight?listing=${auctionListing.id}`
  await expect(highlightPath, cookie, 403)
  const highlightPreview = await expect(highlightPath, adminCookie, 200)
  record(
    "admin previews only a complete, current and genuinely below-median Telegram lot",
    highlightPreview?.preview?.id === auctionListing.id
      && highlightPreview?.preview?.readiness?.ready === true
      && highlightPreview?.preview?.readiness?.filled === 15
      && highlightPreview?.preview?.priceSignal?.ratio < 0.88
      && highlightPreview?.preview?.captionPlainText?.includes("Hyundai Tucson"),
    highlightPreview?.preview
      ? `${highlightPreview.preview.readiness.filled}/15 · ratio ${highlightPreview.preview.priceSignal.ratio}`
      : "preview missing",
  )
  await expect("/api/admin/telegram-auction-highlight", adminCookie, 400, {
    method: "POST",
    body: JSON.stringify({ listing: auctionListing.id, confirm: false }),
  })
  await expect("/api/auctions?country=KR&limit=10", null, 200)
  const auctionDetail = await expect(`/api/auctions/${auctionListing.id}`, null, 200)
  record("auction detail returns ranked similar vehicles", auctionDetail?.similar?.some((item) => item.id === similarAuctionListing.id), `${auctionDetail?.similar?.length ?? 0} similar`)
  await expect(`/api/auctions/${staleAuctionListing.id}`, null, 404)
  await expect("/api/users", cookie, 200)
  await expect("/api/users", cookie, 200, { method: "PATCH", body: JSON.stringify({ name: "Покупатель Проверен" }) })
  const ownPrivateProfile = await expect(`/api/users/${primary.id}`, cookie, 200)
  record(
    "account workspace exposes the owner's verified registration details",
    ownPrivateProfile?.user?.email === primary.email
      && ownPrivateProfile?.user?.phone === primary.phone
      && Boolean(ownPrivateProfile?.user?.emailVerified)
      && Boolean(ownPrivateProfile?.user?.telegramVerifiedAt)
      && ownPrivateProfile?.user?.registrationChannel === "WEB",
    `${ownPrivateProfile?.user?.email || "no email"} · ${ownPrivateProfile?.user?.phone || "no phone"}`,
  )
  const sellerProfile = await expect(`/api/users/${seller.id}`, cookie, 200)
  record(
    "ordinary users cannot read another user's private account fields",
    sellerProfile?.user?.email === undefined && sellerProfile?.user?.phone === undefined && sellerProfile?.user?.role === undefined,
    Object.keys(sellerProfile?.user || {}).join(","),
  )
  const sellerPrivateProfile = await expect(`/api/users/${seller.id}`, adminCookie, 200)
  record(
    "administrator can read private profile data",
    sellerPrivateProfile?.user?.email === seller.email
      && sellerPrivateProfile?.user?.phone === seller.phone
      && sellerPrivateProfile?.user?.registrationChannel === "WEB",
    sellerPrivateProfile?.user?.email || "missing",
  )
  const promotedPartner = await expect(`/api/admin/users/${seller.id}/role`, adminCookie, 200, {
    method: "PATCH",
    body: JSON.stringify({ role: "PARTNER" }),
  })
  record("administrator can assign a delivery partner role", promotedPartner?.user?.role === "PARTNER", promotedPartner?.user?.role || "missing")
  await expect("/api/vehicles", cookie, 200)

  const incompleteVehicle = await expect("/api/vehicles", cookie, 400, {
    method: "POST",
    body: JSON.stringify({
      title: `${marker} incomplete car`, make: "Kia", model: "Sportage", year: 2023,
      price: 2_850_000, mileage: 21_500, vin: `LWMSS${String(Date.now()).slice(-12)}`.slice(0, 17),
      fuelType: "GASOLINE", transmission: "AUTOMATIC", bodyType: "SUV", color: "Серый",
      engineVolume: 2, driveType: "AWD", condition: "EXCELLENT", location: "Москва",
      description: "Карточка намеренно неполная и не должна попасть на модерацию", vehicleType: "CAR",
      categoryId: category.id,
      images: ["https://images.unsplash.com/photo-1549317661-bd32c8ce0db2"],
    }),
  })
  record("incomplete vehicle cannot enter moderation", typeof incompleteVehicle?.error === "string", incompleteVehicle?.error || "missing error")

  await expect("/api/parser/listings/readiness", null, 401, { method: "POST", body: JSON.stringify({ apply: true }) })
  const readinessDryRun = await expect("/api/parser/listings/readiness", null, 200, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PARSER_TOKEN}` },
    body: JSON.stringify({ apply: false }),
  })
  const legacyBeforeEnforcement = await prisma.listing.findUniqueOrThrow({ where: { id: legacyListingId } })
  record(
    "legacy readiness dry-run finds incomplete public cards without changing them",
    readinessDryRun?.issues?.some((issue) => issue.listingId === legacyListingId)
      && legacyBeforeEnforcement.status === "ACTIVE",
    `${readinessDryRun?.incomplete ?? 0} incomplete · ${legacyBeforeEnforcement.status}`,
  )
  const readinessApplied = await expect("/api/parser/listings/readiness", null, 200, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PARSER_TOKEN}` },
    body: JSON.stringify({ apply: true }),
  })
  const legacyAfterEnforcement = await prisma.listing.findUniqueOrThrow({
    where: { id: legacyListingId },
    include: { statusEvents: true },
  })
  const legacyNotification = await prisma.notification.findFirst({
    where: { userId: seller.id, relatedId: legacyListingId, relatedType: "LISTING" },
  })
  record(
    "legacy incomplete listing is reversibly returned to its owner with history and notification",
    readinessApplied?.enforced >= 1
      && legacyAfterEnforcement.status === "REJECTED"
      && legacyAfterEnforcement.publishedAt === null
      && legacyAfterEnforcement.statusEvents.some((event) => event.toStatus === "REJECTED")
      && legacyNotification?.type === "WARNING",
    `${legacyAfterEnforcement.status} · ${legacyAfterEnforcement.statusEvents.length} event(s)`,
  )
  const readinessRepeated = await expect("/api/parser/listings/readiness", null, 200, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PARSER_TOKEN}` },
    body: JSON.stringify({ apply: true }),
  })
  record(
    "legacy readiness enforcement is idempotent",
    readinessRepeated?.enforced === 0
      && readinessRepeated?.issues?.every((issue) => issue.listingId !== legacyListingId),
    `${readinessRepeated?.enforced ?? "missing"} repeated changes`,
  )
  const readinessRestored = await expect("/api/parser/listings/readiness", null, 200, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PARSER_TOKEN}` },
    body: JSON.stringify({ restoreAutoRejected: true }),
  })
  const legacyAfterRestore = await prisma.listing.findUniqueOrThrow({
    where: { id: legacyListingId },
    include: { statusEvents: true },
  })
  record(
    "automatic readiness removals can be restored without losing publication history",
    readinessRestored?.restored >= 1
      && legacyAfterRestore.status === "ACTIVE"
      && legacyAfterRestore.publishedAt instanceof Date
      && legacyAfterRestore.statusEvents.some((event) => event.fromStatus === "REJECTED" && event.toStatus === "ACTIVE"),
    `${legacyAfterRestore.status} · ${readinessRestored?.restored ?? 0} restored`,
  )
  const readinessRestoreRepeated = await expect("/api/parser/listings/readiness", null, 200, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PARSER_TOKEN}` },
    body: JSON.stringify({ restoreAutoRejected: true }),
  })
  record(
    "automatic readiness recovery is idempotent",
    readinessRestoreRepeated?.restored === 0,
    `${readinessRestoreRepeated?.restored ?? "missing"} repeated restorations`,
  )

  const vehicle = await expect("/api/vehicles", cookie, 201, {
    method: "POST",
    body: JSON.stringify({
      title: `${marker} Kia Sportage`, make: "Kia", model: "Sportage", year: 2023,
      price: 2_850_000, mileage: 21_500, vin: `LWBUYER${String(Date.now()).slice(-10)}`.slice(0, 17),
      fuelType: "GASOLINE", transmission: "AUTOMATIC", bodyType: "SUV", color: "Серый",
      power: 180, engineVolume: 2, driveType: "AWD", condition: "EXCELLENT", location: "Москва",
      steeringWheel: "LEFT", ownersCount: 1, documentsStatus: "CLEAN", damageInfo: "NONE",
      sellerType: "OWNER", availability: "IN_STOCK", customsCleared: true, generation: "V (NQ5)",
      description: "Изолированная проверка полного цикла объявления", vehicleType: "CAR",
      categoryId: category.id,
      images: ["https://images.unsplash.com/photo-1549317661-bd32c8ce0db2"],
    }),
  })
  record("vehicle listing created atomically", vehicle?.listings?.[0]?.status === "PENDING_MODERATION", vehicle?.listings?.[0]?.status || "missing")
  const buyerListingId = vehicle.listings[0].id
  await expect(`/api/listings/${buyerListingId}`, cookie, 200)
  await expect("/api/admin/listings", adminCookie, 200)
  const moderatedListing = await expect("/api/admin/listings", adminCookie, 200, {
    method: "PATCH",
    body: JSON.stringify({ id: buyerListingId, status: "ACTIVE" }),
  })
  record("moderation publishes a pending listing with an audit event", moderatedListing?.listing?.status === "ACTIVE", moderatedListing?.listing?.status || "missing")
  const listingAudit = await expect(`/api/admin/audit?action=LISTING_MODERATE&entityType=Listing&q=${buyerListingId}`, adminCookie, 200)
  record(
    "central audit identifies the listing moderator and decision",
    listingAudit?.events?.some((event) => event.entityId === buyerListingId && event.actor?.id === administrator.id),
    `${listingAudit?.events?.length ?? 0} event(s)`,
  )
  const sellerContact = await expect(`/api/listings/${publicListingId}`, cookie, 200, { method: "POST" })
  record("authenticated buyer can reveal the seller phone on an active listing", sellerContact?.phone === seller.phone, sellerContact?.phone || "missing")
  await expect("/api/listings", sellerCookie, 409, {
    method: "POST",
    body: JSON.stringify({ title: "Повторное объявление", price: 3_100_000, vehicleId: sellerVehicle.id }),
  })
  await expect(`/api/listings/${publicListingId}/promote`, cookie, 403, {
    method: "POST",
    body: JSON.stringify({ tariff: "boost" }),
  })
  await expect(`/api/listings/${buyerListingId}/promote`, cookie, 400, {
    method: "POST",
    body: JSON.stringify({ tariff: "unknown" }),
  })

  const report = await expect(`/api/listings/${publicListingId}/reports`, cookie, 201, {
    method: "POST",
    body: JSON.stringify({ reason: "MISLEADING", comment: "Изолированная проверка очереди модерации" }),
  })
  await expect(`/api/listings/${publicListingId}/reports`, cookie, 409, {
    method: "POST",
    body: JSON.stringify({ reason: "MISLEADING" }),
  })
  const reports = await expect("/api/admin/reports", adminCookie, 200)
  record("listing report reaches moderation without duplication", reports?.reports?.some((item) => item.id === report.id), `${reports?.reports?.length ?? 0} reports`)
  await expect("/api/admin/reports", adminCookie, 200, {
    method: "PATCH",
    body: JSON.stringify({ id: report.id, status: "RESOLVED" }),
  })

  const review = await expect("/api/reviews", cookie, 201, {
    method: "POST",
    body: JSON.stringify({ listingId: publicListingId, rating: 5, comment: "Проверенная сделка в изолированном аудите" }),
  })
  await expect(`/api/reviews/${review.id}`, null, 200)
  await expect(`/api/reviews/${review.id}`, cookie, 400, { method: "PUT", body: JSON.stringify({ rating: 4.5, comment: "Дробный рейтинг запрещён" }) })
  await expect(`/api/reviews/${review.id}`, cookie, 400, { method: "PUT", body: "{" })
  const updatedReview = await expect(`/api/reviews/${review.id}`, cookie, 200, { method: "PUT", body: JSON.stringify({ rating: 4, comment: "Обновлённый проверенный отзыв" }) })
  record("review owner can update an integer rating", updatedReview?.rating === 4, String(updatedReview?.rating ?? "missing"))
  const privateReview = await prisma.review.create({ data: { userId: seller.id, listingId: buyerListingId, rating: 3, comment: "Не должен быть виден после снятия с публикации" } })
  await prisma.listing.update({ where: { id: buyerListingId }, data: { status: "PENDING_MODERATION" } })
  await expect(`/api/reviews/${privateReview.id}`, null, 404)
  await expect(`/api/reviews/${review.id}`, cookie, 200, { method: "DELETE" })

  const listingViewOne = await expect(`/api/listings/${publicListingId}/views`, cookie, 200, { method: "POST" })
  const listingViewTwo = await expect(`/api/listings/${publicListingId}/views`, `${cookie}; listing-view-${publicListingId}=1`, 200, { method: "POST" })
  record("listing views are unique within the hourly window", listingViewOne?.views === listingViewTwo?.views, `${listingViewOne?.views} then ${listingViewTwo?.views}`)

  const part = await expect("/api/parts", cookie, 201, {
    method: "POST",
    body: JSON.stringify({
      name: `${marker} тормозные колодки`, description: "Изолированная проверка запчасти", price: 7_500,
      condition: "NEW", partType: "BRAKES", subcategory: "Колодки тормозные", make: "Kia",
      model: "Sportage", yearFrom: 2021, yearTo: 2025, location: "Москва", sellerType: "OWNER",
      availability: "IN_STOCK", saleFormat: "FIXED", oemNumber: "AUDIT-58101",
      images: ["https://images.unsplash.com/photo-1486262715619-67b85e0b08d3"],
      compatibility: [{ make: "Kia", model: "Sportage", yearFrom: 2021, yearTo: 2025 }],
    }),
  })
  record("part listing created atomically", part?.listings?.[0]?.status === "PENDING_MODERATION", part?.listings?.[0]?.status || "missing")
  await expect("/api/parts", cookie, 400, { method: "POST", body: "{" })
  const sitemapResponse = await request("/sitemap.xml", null)
  const sitemapXml = await sitemapResponse.text()
  record("sitemap returns public XML", sitemapResponse.status === 200 && sitemapXml.includes("<urlset"), `HTTP ${sitemapResponse.status}`)
  record("sitemap includes the active marketplace listing", sitemapXml.includes(`/listings/vehicle/${sellerVehicle.id}`), sellerVehicle.id)
  record("sitemap excludes listings awaiting moderation", !sitemapXml.includes(`/listings/vehicle/${vehicle.id}`) && !sitemapXml.includes(`/listings/part/${part.id}`), "pending vehicle and part hidden")
  record("sitemap includes only fresh import lots", sitemapXml.includes(`/auctions/${auctionListing.id}`) && !sitemapXml.includes(`/auctions/${staleAuctionListing.id}`), "fresh visible, stale hidden")
  const auctionPageResponse = await request(`/auctions/${auctionListing.id}`, null)
  const auctionPageHtml = await auctionPageResponse.text()
  record("auction page renders semantic heading and vehicle structured data", auctionPageResponse.status === 200 && auctionPageHtml.includes("<h1") && auctionPageHtml.includes("application/ld+json") && auctionPageHtml.includes("BreadcrumbList"), `HTTP ${auctionPageResponse.status}`)
  const auctionPart = await prisma.part.create({
    data: {
      name: `${marker} аукционная турбина`, description: "Изолированный аукцион запчасти", price: 20_000,
      condition: "USED", make: "Toyota", model: "RAV4", partType: "ENGINE", location: "Москва",
      userId: seller.id, saleFormat: "AUCTION", auctionStatus: "ACTIVE", auctionEndsAt: new Date(Date.now() + 3_600_000),
      auctionStartPrice: 20_000, auctionCurrentPrice: 20_000, auctionMinStep: 1_000,
      images: JSON.stringify(["https://images.unsplash.com/photo-1486262715619-67b85e0b08d3"]),
      listings: { create: { title: `${marker} аукционная турбина`, price: 20_000, status: "ACTIVE", userId: seller.id } },
    },
  })
  const bid = await expect(`/api/parts/${auctionPart.id}/bid`, cookie, 201, {
    method: "POST",
    body: JSON.stringify({ amount: 21_000 }),
  })
  record("part auction accepts a concurrency-safe minimum bid", bid?.bid?.amount === 21_000, String(bid?.bid?.amount ?? "missing"))

  const garageCountBeforeInvalidVin = await prisma.vehicle.count({
    where: { userId: primary.id, category: { name: "Личный гараж" } },
  })
  await expect("/api/garage", cookie, 400, {
    method: "POST",
    body: JSON.stringify({ make: "Hyundai", model: "Tucson", year: 2022, vin: "INVALID" }),
  })
  const garageCountAfterInvalidVin = await prisma.vehicle.count({
    where: { userId: primary.id, category: { name: "Личный гараж" } },
  })
  record(
    "garage rejects an invalid optional VIN without creating a record",
    garageCountBeforeInvalidVin === garageCountAfterInvalidVin,
    `${garageCountBeforeInvalidVin} then ${garageCountAfterInvalidVin}`,
  )

  const garageCountBeforeInvalidOption = await prisma.vehicle.count({
    where: { userId: primary.id, category: { name: "Личный гараж" } },
  })
  await expect("/api/garage", cookie, 400, {
    method: "POST",
    body: JSON.stringify({ make: "Hyundai", model: "Tucson", year: 2022, condition: "SUPER" }),
  })
  const garageCountAfterInvalidOption = await prisma.vehicle.count({
    where: { userId: primary.id, category: { name: "Личный гараж" } },
  })
  record(
    "garage rejects an invalid select option without creating a record",
    garageCountBeforeInvalidOption === garageCountAfterInvalidOption,
    `${garageCountBeforeInvalidOption} then ${garageCountAfterInvalidOption}`,
  )

  const garageVin = `LWGRGE${String(Date.now()).slice(-11)}`
  const garage = await expect("/api/garage", cookie, 201, {
    method: "POST",
    body: JSON.stringify({
      make: "Hyundai", model: "Tucson", year: 2022, mileage: 30_000, vin: garageVin,
      fuelType: "GASOLINE", transmission: "AUTOMATIC", bodyType: "SUV", color: "Синий",
      engineVolume: 1.6, power: 180, driveType: "AWD", condition: "EXCELLENT",
      steeringWheel: "LEFT", ownersCount: 0, documentsStatus: "CLEAN", damageInfo: "NONE",
      sellerType: "OWNER", availability: "IN_STOCK", customsCleared: true, generation: "IV (NX4)",
      location: "Екатеринбург", description: "Личный автомобиль с полными данными для будущего объявления.",
      images: ["/uploads/123e4567-e89b-12d3-a456-426614174000.webp", "https://example.com/external.jpg"],
    }),
  })
  await expect("/api/garage", cookie, 200)
  let garagePrefill = await expect(`/api/garage?id=${encodeURIComponent(garage.id)}`, cookie, 200)
  record(
    "garage keeps a validated VIN, zero previous owners and only local uploaded photos",
    garagePrefill?.vehicle?.id === garage.id
      && garagePrefill?.vehicle?.vin === garageVin
      && garagePrefill?.vehicle?.ownersCount === 0
      && JSON.parse(garagePrefill?.vehicle?.images || "[]").length === 1,
    garagePrefill?.vehicle?.id || "missing",
  )
  record(
    "garage reports publication readiness from the shared moderation contract",
    garagePrefill?.vehicle?.publicationReadiness?.completed < garagePrefill?.vehicle?.publicationReadiness?.total
      && garagePrefill.vehicle.publicationReadiness.missing.some((item) => item.field === "price"),
    `${garagePrefill?.vehicle?.publicationReadiness?.completed ?? "missing"}/${garagePrefill?.vehicle?.publicationReadiness?.total ?? "missing"}`,
  )

  const garageUpdatePayload = {
    ...garagePrefill.vehicle,
    mileage: 31_500,
    color: "Белый",
    images: JSON.parse(garagePrefill.vehicle.images || "[]"),
  }
  await expect(`/api/garage?id=${encodeURIComponent(garage.id)}`, sellerCookie, 404, {
    method: "PATCH",
    body: JSON.stringify(garageUpdatePayload),
  })
  const updatedGarage = await expect(`/api/garage?id=${encodeURIComponent(garage.id)}`, cookie, 200, {
    method: "PATCH",
    body: JSON.stringify(garageUpdatePayload),
  })
  record(
    "garage owner can edit the private card while another user cannot",
    updatedGarage?.id === garage.id && updatedGarage?.mileage === 31_500 && updatedGarage?.color === "Белый",
    `${updatedGarage?.mileage ?? "missing"} km · ${updatedGarage?.color || "missing"}`,
  )
  garagePrefill = { vehicle: updatedGarage }

  const garageListingPayload = {
    garageVehicleId: garage.id,
    title: `${marker} Hyundai Tucson from garage`,
    make: garagePrefill.vehicle.make,
    model: garagePrefill.vehicle.model,
    year: garagePrefill.vehicle.year,
    price: 2_990_000,
    mileage: garagePrefill.vehicle.mileage,
    vin: garagePrefill.vehicle.vin,
    fuelType: garagePrefill.vehicle.fuelType,
    transmission: garagePrefill.vehicle.transmission,
    bodyType: garagePrefill.vehicle.bodyType,
    color: garagePrefill.vehicle.color,
    engineVolume: garagePrefill.vehicle.engineVolume,
    power: garagePrefill.vehicle.power,
    driveType: garagePrefill.vehicle.driveType,
    condition: garagePrefill.vehicle.condition,
    steeringWheel: garagePrefill.vehicle.steeringWheel,
    ownersCount: garagePrefill.vehicle.ownersCount,
    documentsStatus: garagePrefill.vehicle.documentsStatus,
    damageInfo: garagePrefill.vehicle.damageInfo,
    sellerType: garagePrefill.vehicle.sellerType,
    availability: garagePrefill.vehicle.availability,
    customsCleared: garagePrefill.vehicle.customsCleared,
    generation: garagePrefill.vehicle.generation,
    location: garagePrefill.vehicle.location,
    description: garagePrefill.vehicle.description,
    images: garagePrefill.vehicle.images,
    vehicleType: "CAR",
    categoryId: category.id,
  }
  const garageListingVehicle = await expect("/api/vehicles", cookie, 201, {
    method: "POST",
    body: JSON.stringify(garageListingPayload),
  })
  await expect(`/api/garage?id=${encodeURIComponent(garage.id)}`, cookie, 404)
  const storedGarageListingVehicle = await prisma.vehicle.findUniqueOrThrow({
    where: { id: garage.id },
    include: { category: true, listings: true },
  })
  const garageVinCopies = await prisma.vehicle.count({ where: { vin: garageVin } })
  record(
    "garage vehicle becomes one moderated listing without duplicating VIN or photos",
    garageListingVehicle?.id === garage.id
      && garageListingVehicle?.listings?.[0]?.status === "PENDING_MODERATION"
      && storedGarageListingVehicle.category.name !== "Личный гараж"
      && storedGarageListingVehicle.listings.length === 1
      && garageVinCopies === 1
      && storedGarageListingVehicle.images === garagePrefill.vehicle.images,
    `${garageVinCopies} VIN record · ${storedGarageListingVehicle.listings.length} listing`,
  )
  await expect("/api/vehicles", cookie, 409, {
    method: "POST",
    body: JSON.stringify(garageListingPayload),
  })
  record("garage-to-listing conversion cannot be replayed", true, "HTTP 409")

  await expect("/api/favorites", cookie, 201, { method: "POST", body: JSON.stringify({ listingId: publicListingId }) })
  const favoriteIds = await expect("/api/favorites?idsOnly=true", cookie, 200)
  record("favorite appears in compact response", favoriteIds?.ids?.includes(publicListingId), `${favoriteIds?.count ?? 0} favorite(s)`)
  await expect(`/api/favorites?listingId=${encodeURIComponent(publicListingId)}`, cookie, 200, { method: "DELETE" })

  const firstMessage = await expect("/api/messages", cookie, 201, {
    method: "POST",
    body: JSON.stringify({ receiverId: seller.id, listingId: publicListingId, content: "Здравствуйте! Объявление актуально?" }),
  })
  await expect("/api/messages", sellerCookie, 201, {
    method: "POST",
    body: JSON.stringify({ receiverId: primary.id, listingId: publicListingId, content: "Да, автомобиль доступен для осмотра." }),
  })
  await expect("/api/messages", cookie, 200)
  const conversation = await expect(`/api/messages/${firstMessage.conversationId}?page=1&limit=20`, cookie, 200)
  record("conversation returns both participants and listing context", conversation?.messages?.length === 2 && conversation?.otherUser?.id === seller.id && conversation?.listing?.id === publicListingId, `${conversation?.messages?.length ?? 0} messages`)
  const forgedPhotoForm = new FormData()
  forgedPhotoForm.set("receiverId", seller.id)
  forgedPhotoForm.set("listingId", publicListingId)
  forgedPhotoForm.set("files", new File([Buffer.from("not a real image")], "forged.png", { type: "image/png" }))
  await expect("/api/messages", cookie, 400, { method: "POST", body: forgedPhotoForm })
  record("message attachment rejects a forged image signature", true, "HTTP 400")
  const photoForm = new FormData()
  photoForm.set("receiverId", seller.id)
  photoForm.set("listingId", publicListingId)
  photoForm.set("content", "Фото состояния кузова")
  photoForm.set("files", new File([
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWOQd5oo7zSRAUIBABi+A8n887YYAAAAAElFTkSuQmCC", "base64"),
  ], "audit-car.png", { type: "image/png" }))
  const photoMessage = await expect("/api/messages", cookie, 201, { method: "POST", body: photoForm })
  record(
    "conversation accepts an optimized private photo attachment",
    photoMessage?.attachments?.length === 1 && photoMessage.attachments[0].mimeType === "image/jpeg",
    `${photoMessage?.attachments?.length ?? 0} attachment(s)`,
  )
  const attachmentUrl = photoMessage?.attachments?.[0]?.downloadUrl
  const senderAttachment = attachmentUrl ? await request(attachmentUrl, cookie) : null
  const receiverAttachment = attachmentUrl ? await request(attachmentUrl, sellerCookie) : null
  const outsiderAttachment = attachmentUrl ? await request(attachmentUrl, revocableAdminCookie) : null
  record(
    "private message photo downloads only for both conversation participants",
    senderAttachment?.status === 200
      && receiverAttachment?.status === 200
      && outsiderAttachment?.status === 403
      && senderAttachment.headers.get("content-type") === "image/jpeg"
      && senderAttachment.headers.get("cache-control")?.includes("no-store"),
    `${senderAttachment?.status ?? "missing"}/${receiverAttachment?.status ?? "missing"}/${outsiderAttachment?.status ?? "missing"}`,
  )
  const conversationWithPhoto = await expect(`/api/messages/${firstMessage.conversationId}?page=1&limit=20`, sellerCookie, 200)
  record(
    "receiver sees the private attachment metadata without its storage key",
    conversationWithPhoto?.messages?.some((message) => message.id === photoMessage.id
      && message.attachments?.[0]?.downloadUrl === attachmentUrl
      && message.attachments[0].storageKey === undefined),
    `${conversationWithPhoto?.messages?.length ?? 0} messages`,
  )
  await expect(`/api/messages/${firstMessage.conversationId}`, cookie, 200, { method: "PUT" })

  const notification = await prisma.notification.create({ data: { userId: primary.id, type: "INFO", title: "Проверка", content: marker } })
  await expect("/api/notifications?unreadCountOnly=true", cookie, 200)
  await expect("/api/notifications", cookie, 200, { method: "PATCH", body: JSON.stringify({ id: notification.id }) })
  await expect(`/api/notifications?id=${encodeURIComponent(notification.id)}`, cookie, 200, { method: "DELETE" })

  await expect("/api/ai/valuation", cookie, 200, { method: "POST", body: JSON.stringify({ vehicleId: vehicle.id }) })
  await expect("/api/ai/smart-matching", cookie, 200, { method: "POST", body: JSON.stringify({ vehicleId: vehicle.id, limit: 5 }) })
  const historyRequest = await expect("/api/ai/history-check", cookie, 201, { method: "POST", body: JSON.stringify({ vehicleId: vehicle.id }) })
  record("history check stays pending until a verified provider exists", historyRequest?.request?.status === "REQUESTED", historyRequest?.request?.status || "missing")
  const prediction = await expect("/api/ai/price-prediction", cookie, 200, { method: "POST", body: JSON.stringify({ vehicleId: vehicle.id, monthsAhead: 12 }) })
  record("price prediction contains an explicit preliminary disclaimer", typeof prediction?.disclaimer === "string" && prediction.disclaimer.includes("не учитывает"), prediction?.disclaimer || "missing")
  const damageRequest = await expect("/api/ai/damage-assessment", cookie, 202, {
    method: "POST",
    body: JSON.stringify({ vehicleId: vehicle.id, imageUrl: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2" }),
  })
  record("damage assessment stays pending until computer vision is connected", damageRequest?.request?.status === "REQUESTED", damageRequest?.request?.status || "missing")
  await expect("/api/ai/damage-assessment", cookie, 400, {
    method: "POST",
    body: JSON.stringify({ vehicleId: vehicle.id, imageUrl: "https://example.com/not-owned.jpg" }),
  })
  await expect("/api/ai/valuation", cookie, 403, { method: "POST", body: JSON.stringify({ vehicleId: sellerVehicle.id }) })

  const delivery = await expect("/api/delivery-orders", cookie, 201, {
    method: "POST",
    body: JSON.stringify({ title: "Доставка автомобиля из Кореи", kind: "VEHICLE", sourceType: "DIRECT_IMPORT", originCountry: "KR", destinationCity: "Москва", description: "Изолированная проверка заявки" }),
  })
  record("delivery order has timeline and chat", Boolean(delivery?.order?.events?.length && delivery?.order?.messages?.length), "created")
  await expect("/api/delivery-orders", cookie, 200)
  await expect(`/api/delivery-orders/${delivery.order.id}`, cookie, 200)
  await expect(`/api/delivery-orders/${delivery.order.id}`, cookie, 403, {
    method: "PATCH",
    body: JSON.stringify({ nextAction: "Покупатель не должен менять служебный маршрут" }),
  })
  await expect(`/api/delivery-orders/${delivery.order.id}`, adminCookie, 200, {
    method: "PATCH",
    body: JSON.stringify({ nextAction: "Подтвердить условия задатка", nextActionAt: new Date(Date.now() + 86_400_000).toISOString() }),
  })
  const deliveryMessage = await expect(`/api/delivery-orders/${delivery.order.id}/messages`, cookie, 201, {
    method: "POST",
    body: JSON.stringify({ content: "Подскажите, какие документы нужны для договора?" }),
  })
  record("buyer can write in the protected delivery chat", deliveryMessage?.message?.sender?.id === primary.id, deliveryMessage?.message?.id || "missing")
  const deliveryEvent = await expect(`/api/delivery-orders/${delivery.order.id}/events`, adminCookie, 201, {
    method: "POST",
    body: JSON.stringify({ status: "DEPOSIT_PENDING", description: "Условия задатка подготовлены", nextAction: "Ознакомиться со счётом" }),
  })
  record("delivery timeline only advances to the next milestone", deliveryEvent?.event?.status === "DEPOSIT_PENDING", deliveryEvent?.event?.status || "missing")
  const payment = await expect(`/api/delivery-orders/${delivery.order.id}/payments`, adminCookie, 201, {
    method: "POST",
    body: JSON.stringify({ category: "DEPOSIT", amount: 50_000, currency: "RUB", payeeName: "LeWheel Audit", invoiceNumber: marker }),
  })
  record("manager can issue a structured deal invoice", payment?.payment?.status === "INVOICE_ISSUED", payment?.payment?.status || "missing")

  const receiptForm = new FormData()
  receiptForm.set("title", "Квитанция изолированного аудита")
  receiptForm.set("category", "RECEIPT")
  receiptForm.set("paymentId", payment.payment.id)
  receiptForm.set("file", new File([Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n")], "audit-receipt.pdf", { type: "application/pdf" }))
  const uploadedDocument = await expect(`/api/delivery-orders/${delivery.order.id}/documents`, cookie, 201, {
    method: "POST",
    body: receiptForm,
  })
  const documentResponse = await request(uploadedDocument.document.downloadUrl, cookie)
  record("private delivery document downloads only through the authorized route", documentResponse.status === 200 && documentResponse.headers.get("content-type") === "application/pdf" && documentResponse.headers.get("cache-control")?.includes("no-store"), `HTTP ${documentResponse.status}`)
  const documentHub = await expect("/api/delivery-documents", cookie, 200)
  record("personal document hub returns authorized delivery files", documentHub?.documents?.some((document) => document.id === uploadedDocument.document.id && document.downloadUrl === uploadedDocument.document.downloadUrl), `${documentHub?.documents?.length ?? 0} document(s)`)
  await expect("/api/delivery-documents", null, 401)
  const confirmedPayment = await expect(`/api/delivery-orders/${delivery.order.id}/payments/${payment.payment.id}`, adminCookie, 200, {
    method: "PATCH",
    body: JSON.stringify({ status: "CONFIRMED" }),
  })
  record("manager confirms a receipt only after buyer upload", confirmedPayment?.success === true, String(confirmedPayment?.success ?? false))
  const deliveryDetail = await expect(`/api/delivery-orders/${delivery.order.id}`, cookie, 200)
  record("buyer sees the updated timeline, invoice and document", deliveryDetail?.order?.events?.some((event) => event.status === "DEPOSIT_PENDING") && deliveryDetail?.order?.payments?.some((item) => item.status === "CONFIRMED") && deliveryDetail?.order?.documents?.some((item) => item.id === uploadedDocument.document.id), `${deliveryDetail?.order?.events?.length ?? 0} events`)
  await expect(`/api/delivery-orders/${delivery.order.id}/documents`, cookie, 415, {
    method: "POST",
    body: JSON.stringify({ invalid: true }),
  })

  const organization = await prisma.deliveryOrganization.create({
    data: { ownerId: seller.id, legalName: `${marker} Логистика`, inn: String(Date.now()).slice(-10), organizationType: "LOGISTICS", verificationStatus: "PENDING" },
  })
  const organizations = await expect("/api/admin/delivery-organizations?status=PENDING&limit=30", adminCookie, 200)
  record("new delivery partner appears in the verification registry", organizations?.organizations?.some((item) => item.id === organization.id), `${organizations?.organizations?.length ?? 0} pending`)
  const verifiedOrganization = await expect("/api/admin/delivery-organizations", adminCookie, 200, {
    method: "PATCH",
    body: JSON.stringify({ id: organization.id, verificationStatus: "VERIFIED", verificationSource: "FNS", verificationNote: "Изолированная проверка реквизитов" }),
  })
  record("administrator can verify a partner with a recorded source", verifiedOrganization?.organization?.verificationStatus === "VERIFIED" && Boolean(verifiedOrganization?.organization?.fnsCheckedAt), verifiedOrganization?.organization?.verificationStatus || "missing")
  const organizationAudit = await expect(`/api/admin/audit?action=DELIVERY_ORGANIZATION_VERIFY&entityType=DeliveryOrganization&q=${organization.id}`, adminCookie, 200)
  record(
    "partner verification records the administrator and target organization",
    organizationAudit?.events?.some((event) => event.entityId === organization.id && event.actor?.id === administrator.id),
    `${organizationAudit?.events?.length ?? 0} event(s)`,
  )
  const partnerUser = await prisma.user.findUnique({ where: { id: seller.id } })
  record("verified delivery organization activates the partner role", partnerUser?.role === "PARTNER", partnerUser?.role || "missing")
  const partnerCookie = await sessionCookie(partnerUser)

  await expect(`/api/auctions/${auctionListing.id}/inquiry`, null, 401, {
    method: "POST",
    body: JSON.stringify({ name: "Гость", phone: "+79990000000", city: "Уфа" }),
  })
  const auctionInquiry = await expect(`/api/auctions/${auctionListing.id}/inquiry`, cookie, 201, {
    method: "POST",
    body: JSON.stringify({ name: "Покупатель Аудит", phone: primary.phone, email: primary.email, city: "Уфа", comment: "Нужны проверка лота, выкуп и доставка" }),
  })
  const inquiryWorkspace = await expect("/api/admin/auctions/inquiries?status=NEW", adminCookie, 200)
  record("authenticated auction inquiry reaches the private admin workspace", inquiryWorkspace?.inquiries?.some((item) => item.id === auctionInquiry.inquiry.id && item.requesterId === primary.id) && inquiryWorkspace?.partners?.some((item) => item.userId === seller.id), `${inquiryWorkspace?.partners?.length ?? 0} verified partner(s)`)
  const assignedInquiry = await expect("/api/admin/auctions/inquiries", adminCookie, 200, {
    method: "PATCH",
    body: JSON.stringify({ action: "ASSIGN", id: auctionInquiry.inquiry.id, partnerId: seller.id, buyerDepositAmount: 100_000, platformFeeAmount: 30_000 }),
  })
  record("admin assignment atomically opens the protected deal", Boolean(assignedInquiry?.inquiry?.deliveryOrderId), assignedInquiry?.inquiry?.deliveryOrderId || "missing")
  const inquiryAudit = await expect(`/api/admin/audit?action=AUCTION_INQUIRY_ASSIGN&entityType=AuctionInquiry&q=${auctionInquiry.inquiry.id}`, adminCookie, 200)
  record(
    "auction assignment records the administrator without exposing buyer contacts",
    inquiryAudit?.events?.some((event) => event.entityId === auctionInquiry.inquiry.id && event.actor?.id === administrator.id && !/[+@]/.test(event.summary)),
    `${inquiryAudit?.events?.length ?? 0} event(s)`,
  )
  const assignedDeal = await expect(`/api/delivery-orders/${assignedInquiry.inquiry.deliveryOrderId}`, partnerCookie, 200)
  record("partner sees buyer name and city without phone or email", assignedDeal?.order?.buyer?.name === "Покупатель Проверен" && assignedDeal?.order?.destinationCity === "Уфа" && !("phone" in assignedDeal.order.buyer) && !("email" in assignedDeal.order.buyer), assignedDeal?.order?.destinationCity || "missing")
  const messagesBeforeBlock = assignedDeal?.order?.messages?.length || 0
  const blockedContact = await expect(`/api/delivery-orders/${assignedInquiry.inquiry.deliveryOrderId}/messages`, cookie, 422, {
    method: "POST",
    body: JSON.stringify({ content: "Напишите мне в телеграм @audit_dealer или +7 987 015-71-46" }),
  })
  record("protected chat blocks contact sharing before delivery", blockedContact?.code === "CONTACT_SHARING_BLOCKED", blockedContact?.code || "missing")
  const afterBlockedContact = await expect(`/api/delivery-orders/${assignedInquiry.inquiry.deliveryOrderId}`, cookie, 200)
  const moderationEvents = await prisma.communicationModerationEvent.count({ where: { deliveryOrderId: assignedInquiry.inquiry.deliveryOrderId } })
  record("blocked contact is not stored while a redacted audit event remains", afterBlockedContact?.order?.messages?.length === messagesBeforeBlock && moderationEvents === 1, `${afterBlockedContact?.order?.messages?.length ?? 0} messages · ${moderationEvents} event(s)`)
  await expect(`/api/delivery-orders/${assignedInquiry.inquiry.deliveryOrderId}/messages`, partnerCookie, 201, {
    method: "POST",
    body: JSON.stringify({ content: "Проверю отчёт по повреждениям и подготовлю перечень документов." }),
  })
  const suspendedOrganization = await expect("/api/admin/delivery-organizations", adminCookie, 200, {
    method: "PATCH",
    body: JSON.stringify({ id: organization.id, verificationStatus: "SUSPENDED", verificationNote: "Изолированная проверка отзыва доступа" }),
  })
  const suspendedPartner = await prisma.user.findUnique({ where: { id: seller.id } })
  record(
    "suspending a partner revokes the role transactionally",
    suspendedOrganization?.organization?.verificationStatus === "SUSPENDED" && suspendedPartner?.role !== "PARTNER",
    `${suspendedOrganization?.organization?.verificationStatus || "missing"} · ${suspendedPartner?.role || "missing"}`,
  )
  const suspendedOffers = await expect("/api/partner/auction-offers", partnerCookie, 200)
  record(
    "suspended partner loses the private offer queue on the next request",
    suspendedOffers?.organization === null && suspendedOffers?.offers?.length === 0,
    `${suspendedOffers?.offers?.length ?? 0} offer(s)`,
  )
  await expect(`/api/delivery-orders/${assignedInquiry.inquiry.deliveryOrderId}`, partnerCookie, 403)

  await expect("/api/upload", cookie, 415, { method: "POST", body: JSON.stringify({ invalid: true }) })
  await expect("/api/listings?limit=10", null, 200)
  await expect("/api/reviews?ratingMin=1&ratingMax=5&limit=10", null, 200)
  await expect("/api/news/import", null, 401, { method: "POST", body: JSON.stringify({ items: [] }) })
  await expect("/api/parser/encar", null, 401, { method: "POST", body: JSON.stringify({}) })
  await expect("/api/parser/encar/refresh", null, 401, { method: "POST", body: JSON.stringify({}) })
  await expect("/api/parser/encar/sync", null, 401, { method: "POST", body: JSON.stringify({}) })
  await expectOneOf("/api/telegram/webhook", null, [401, 503], { method: "POST", body: JSON.stringify({ update_id: 1 }) })

  await expect("/api/admin/audit", cookie, 403)
  await prisma.adminAuditEvent.createMany({
    data: Array.from({ length: 32 }, (_, index) => ({
      actorId: administrator.id,
      actorEmail: administrator.email,
      action: "SUPPORT_TICKET_UPDATE",
      entityType: "AuditFixture",
      entityId: `${marker}-page-${index}`,
      summary: `${marker} проверка постраничного журнала ${index}`,
    })),
  })
  const firstAuditPage = await expect(`/api/admin/audit?entityType=AuditFixture&q=${marker}`, adminCookie, 200)
  const secondAuditPage = await expect(`/api/admin/audit?entityType=AuditFixture&q=${marker}&cursor=${firstAuditPage.nextCursor}`, adminCookie, 200)
  record(
    "admin audit search is private and paginates without dropping events",
    firstAuditPage?.events?.length === 30 && Boolean(firstAuditPage?.nextCursor) && secondAuditPage?.events?.length === 2 && secondAuditPage?.nextCursor === null,
    `${firstAuditPage?.events?.length ?? 0} + ${secondAuditPage?.events?.length ?? 0} event(s)`,
  )

  const sourceCountries = {
    USS: "JP", TAA: "JP", EMARAAT: "KR", AJ: "KR", KCAR: "KR", KB_CHA_CHA_CHA: "KR", ENCAR: "KR",
    COPART: "US", IAAI: "US", MOBILE_DE: "DE", YCHEZHAI: "CN",
    GUAZI: "CN", CHE168: "CN", AUTOHOME: "CN", DONGCHEDI: "CN", TAOCHE: "CN", UCAR: "CN",
  }
  const gallery = Array.from({ length: 35 }, (_, index) => `https://images.example.com/${marker}/${index + 1}.jpg`)
  const feedItems = Object.entries(sourceCountries).map(([source, country], index) => ({
    source,
    sourceId: `${marker}-${source}`,
    country,
    sourceCurrency: country === "JP" ? "JPY" : country === "KR" ? "KRW" : country === "CN" ? "CNY" : country === "DE" ? "EUR" : "USD",
    sourcePrice: 1_000_000 + index,
    year: new Date().getFullYear(),
    manufacturedMonth: new Date().toISOString().slice(0, 7),
    make: "Toyota",
    model: `Audit ${source}`,
    sourceUrl: `https://example.com/${source.toLowerCase()}/${marker}`,
    images: gallery,
    power: 150,
    bodyType: "SUV",
    fuelType: "GASOLINE",
    transmission: "AUTOMATIC",
    equipment: { totalReported: 2, items: [{ label: "Камера заднего вида", available: true }, { label: "Люк", available: false }] },
    conditionInfo: { insuranceRecordCount: 0, inspectionSummary: "Проверка feed", newCarPriceRatioPct: 75, verifiedItems: [{ label: "Каркас", status: "проверен" }] },
  }))
  const feedDryRun = await expect("/api/parser/auctions", null, 200, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PARSER_TOKEN}` },
    body: JSON.stringify({ dryRun: true, items: feedItems }),
  })
  record("all configured country feeds validate with complete galleries", feedDryRun?.validated === feedItems.length && feedDryRun?.imagesValidated === feedItems.length * gallery.length, `${feedDryRun?.validated ?? 0} sources · ${feedDryRun?.imagesValidated ?? 0} photos`)
  const outdatedFeed = { ...feedItems[0], sourceId: `${marker}-too-old`, year: new Date().getFullYear() - 6, manufacturedMonth: `${new Date().getFullYear() - 6}-01` }
  await expect("/api/parser/auctions", null, 400, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PARSER_TOKEN}` },
    body: JSON.stringify({ dryRun: true, items: [outdatedFeed] }),
  })
}

try {
  await run()
  const passed = results.filter((item) => item.ok).length
  console.log(`SUMMARY pass=${passed} fail=0`)
} finally {
  await prisma.$disconnect()
}
