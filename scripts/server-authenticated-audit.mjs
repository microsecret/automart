#!/usr/bin/env node

import crypto from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"

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
  const category = await prisma.category.upsert({
    where: { name: "Легковые" },
    update: {},
    create: { name: "Легковые", description: "Изолированная серверная проверка", icon: "car" },
  })
  const primary = await prisma.user.create({
    data: { email: `${marker}-buyer@audit.lewheel.invalid`, phone: `+7997${String(Date.now()).slice(-7)}`, name: "Покупатель Аудит", role: "USER", emailVerified: new Date() },
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
      transmission: "AUTOMATIC", bodyType: "SUV", color: "Белый", power: 199,
      driveType: "AWD", condition: "EXCELLENT", location: "Москва", vehicleType: "CAR",
      images: JSON.stringify(["https://images.unsplash.com/photo-1549317661-bd32c8ce0db2"]),
      userId: seller.id, categoryId: category.id,
      listings: { create: { title: `${marker} Toyota RAV4`, price: 3_100_000, status: "ACTIVE", userId: seller.id } },
    },
    include: { listings: true },
  })
  const publicListingId = sellerVehicle.listings[0].id
  const auctionListing = await prisma.auctionListing.create({
    data: {
      sourceId: `${marker}-encar-lot`, source: "ENCAR", sourceUrl: `https://www.encar.com/${marker}`,
      make: "Hyundai", model: "Tucson", year: new Date().getFullYear(), mileage: 12_000,
      sourcePrice: 25_000_000, sourceCurrency: "KRW", priceRub: 1_500_000, markup: 200_000,
      finalPrice: 1_700_000, country: "KR", status: "ACTIVE", sourceLastSeenAt: new Date(),
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
  const cookie = await sessionCookie(primary)
  const sellerCookie = await sessionCookie(seller)
  const adminCookie = await sessionCookie(administrator)
  const revocableAdminCookie = await sessionCookie(revocableAdministrator)
  const removableUserCookie = await sessionCookie(removableUser)

  const registrationEmail = `${marker}-web@audit.lewheel.invalid`
  const registrationPhone = `+7998${String(Date.now()).slice(-7)}`
  const registration = await expect("/api/auth/register", null, 201, {
    method: "POST",
    body: JSON.stringify({ name: "Веб Регистрация", email: registrationEmail, phone: registrationPhone, password: "AuditPass-2026" }),
  })
  const registeredUser = await prisma.user.findUnique({ where: { email: registrationEmail } })
  record(
    "web registration persists a protected unverified account",
    registration?.requiresEmailVerification === true && registeredUser?.role === "USER" && registeredUser.emailVerified === null && registeredUser.hashedPassword?.startsWith("$2"),
    registeredUser?.id || "missing",
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
  const otpCode = "73195"
  await prisma.telegramAuthCode.create({
    data: {
      phone: primary.phone,
      codeHash: crypto.createHmac("sha256", process.env.NEXTAUTH_SECRET).update(otpCode).digest("hex"),
      purpose: "LOGIN",
      expiresAt: new Date(Date.now() + 10 * 60_000),
    },
  })
  const telegramOtp = await expect("/api/auth/telegram/verify-code", null, 200, {
    method: "POST",
    body: JSON.stringify({ phone: primary.phone, code: otpCode }),
  })
  record("Telegram phone OTP consumes once and returns the linked account", telegramOtp?.user?.id === primary.id, telegramOtp?.user?.id || "missing")
  await expect("/api/auth/resend-verification", null, 400, { method: "POST", body: "{" })
  await expect("/api/auth/telegram/request-code", null, 400, { method: "POST", body: JSON.stringify({ phone: "123" }) })
  await expect("/api/auth/telegram/verify-code", null, 400, { method: "POST", body: JSON.stringify({ phone: registrationPhone }) })
  await expect("/api/auth/verify-email?token=invalid-audit-token", null, 307, { redirect: "manual" })

  const brands = await expect("/api/v1/brands?category=CAR", null, 200)
  record("brand directory exposes a production catalog", brands?.total > 20 && brands?.brands?.some((brand) => brand.name === "Toyota"), `${brands?.total ?? 0} brands`)
  const brandModels = await expect("/api/v1/brands/Toyota/models?category=CAR", null, 200)
  record("brand model cascade exposes Toyota models", brandModels?.models?.length > 0, `${brandModels?.models?.length ?? 0} models`)
  await expect("/api/v1/models?brand_id=Toyota&category=CAR", null, 200)
  await expect("/api/categories", null, 200)
  await expect("/api/stats", null, 200)
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
  record("admin dashboard separates views, visitors, sessions and authenticated users", adminStats?.traffic?.pageViews7d >= 1 && adminStats?.traffic?.uniqueVisitors7d >= 1 && adminStats?.traffic?.sessions7d >= 1 && adminStats?.traffic?.authenticatedVisitors7d >= 1 && adminStats?.traffic?.attributedRegistrations7d >= 0 && adminStats?.traffic?.registrationConversion7d <= 100 && adminStats?.traffic?.devices?.some((item) => item.key === "MOBILE") && adminStats?.traffic?.sources?.some((item) => item.key === "UTM:TELEGRAM"), `${adminStats?.traffic?.pageViews7d ?? 0} views · ${adminStats?.traffic?.uniqueVisitors7d ?? 0} visitors · ${adminStats?.traffic?.registrationConversion7d ?? 0}% conversion`)
  record("source transport reports a valid bounded TCP pool", adminStats?.sourceTransport?.configurationValid === true && adminStats?.sourceTransport?.active + adminStats?.sourceTransport?.quarantined === adminStats?.sourceTransport?.configured && adminStats?.sourceTransport?.maxConnectionsPerProxy >= 1 && adminStats?.sourceTransport?.maxConnectionsPerProxy <= 50 && adminStats?.sourceTransport?.hardLimit === 50, `${adminStats?.sourceTransport?.active ?? 0}/${adminStats?.sourceTransport?.configured ?? 0} active · cap ${adminStats?.sourceTransport?.maxConnectionsPerProxy ?? "missing"}`)
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
  const popularNews = await expect(`/api/news?sort=popular&q=${encodeURIComponent(marker)}&limit=3`, null, 200)
  record("popular news is ordered by real view count", popularNews?.news?.map((item) => item.views).join(",") === "100,20,5", popularNews?.news?.map((item) => item.views).join(",") || "missing")
  const viewedNews = await prisma.news.findFirstOrThrow({ where: { title: `${marker} небольшой интерес` }, select: { id: true } })
  const newsViewOne = await expect(`/api/news/${viewedNews.id}`, null, 200)
  const newsViewTwo = await expect(`/api/news/${viewedNews.id}`, `news-view-${viewedNews.id}=1`, 200)
  record("news views are unique within the hourly window", newsViewOne?.views === newsViewTwo?.views, `${newsViewOne?.views} then ${newsViewTwo?.views}`)
  const inquiry = await expect(`/api/auctions/${auctionListing.id}/inquiry`, null, 201, {
    method: "POST",
    body: JSON.stringify({ name: "Покупатель Аудит", phone: primary.phone, email: primary.email, city: "Москва", comment: "Нужен расчёт доставки" }),
  })
  const inquiryQueue = await expect("/api/admin/auctions/inquiries?status=NEW", adminCookie, 200)
  record("auction inquiry reaches the manager queue", inquiryQueue?.inquiries?.some((item) => item.id === inquiry?.inquiry?.id), `${inquiryQueue?.inquiries?.length ?? 0} new`)
  const updatedInquiry = await expect("/api/admin/auctions/inquiries", adminCookie, 200, {
    method: "PATCH",
    body: JSON.stringify({ id: inquiry.inquiry.id, status: "CONTACTED", managerNotes: "Связались в рамках изолированного аудита" }),
  })
  record("manager can update inquiry status and notes", updatedInquiry?.inquiry?.status === "CONTACTED" && Boolean(updatedInquiry?.inquiry?.managerNotes), updatedInquiry?.inquiry?.status || "missing")
  await expect("/api/admin/auctions/stats", adminCookie, 200)
  await expect("/api/auctions?country=KR&limit=10", null, 200)
  await expect(`/api/auctions/${auctionListing.id}`, null, 200)
  await expect(`/api/auctions/${staleAuctionListing.id}`, null, 404)
  await expect("/api/users", cookie, 200)
  await expect("/api/users", cookie, 200, { method: "PATCH", body: JSON.stringify({ name: "Покупатель Проверен" }) })
  const sellerProfile = await expect(`/api/users/${seller.id}`, cookie, 200)
  record("ordinary users cannot read another user's email", sellerProfile?.user?.email === undefined, Object.keys(sellerProfile?.user || {}).join(","))
  const sellerPrivateProfile = await expect(`/api/users/${seller.id}`, adminCookie, 200)
  record("administrator can read private profile data", sellerPrivateProfile?.user?.email === seller.email, sellerPrivateProfile?.user?.email || "missing")
  const promotedPartner = await expect(`/api/admin/users/${seller.id}/role`, adminCookie, 200, {
    method: "PATCH",
    body: JSON.stringify({ role: "PARTNER" }),
  })
  record("administrator can assign a delivery partner role", promotedPartner?.user?.role === "PARTNER", promotedPartner?.user?.role || "missing")
  await expect("/api/vehicles", cookie, 200)

  const vehicle = await expect("/api/vehicles", cookie, 201, {
    method: "POST",
    body: JSON.stringify({
      title: `${marker} Kia Sportage`, make: "Kia", model: "Sportage", year: 2023,
      price: 2_850_000, mileage: 21_500, vin: `LWBUYER${String(Date.now()).slice(-10)}`.slice(0, 17),
      fuelType: "GASOLINE", transmission: "AUTOMATIC", bodyType: "SUV", color: "Серый",
      power: 180, engineVolume: 2, driveType: "AWD", condition: "EXCELLENT", location: "Москва",
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

  const garage = await expect("/api/garage", cookie, 201, {
    method: "POST",
    body: JSON.stringify({ make: "Hyundai", model: "Tucson", year: 2022, mileage: 30_000, fuelType: "GASOLINE", transmission: "AUTOMATIC", bodyType: "SUV", color: "Синий", location: "Екатеринбург" }),
  })
  await expect("/api/garage", cookie, 200)
  await expect(`/api/garage?id=${encodeURIComponent(garage.id)}`, cookie, 200, { method: "DELETE" })

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
    body: JSON.stringify({ title: `${marker} доставка автомобиля`, kind: "VEHICLE", sourceType: "DIRECT_IMPORT", originCountry: "KR", destinationCity: "Москва", description: "Изолированная проверка заявки" }),
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

  await expect("/api/upload", cookie, 415, { method: "POST", body: JSON.stringify({ invalid: true }) })
  await expect("/api/listings?limit=10", null, 200)
  await expect("/api/reviews?ratingMin=1&ratingMax=5&limit=10", null, 200)
  await expect("/api/news/import", null, 401, { method: "POST", body: JSON.stringify({ items: [] }) })
  await expect("/api/parser/encar", null, 401, { method: "POST", body: JSON.stringify({}) })
  await expect("/api/parser/encar/refresh", null, 401, { method: "POST", body: JSON.stringify({}) })
  await expect("/api/parser/encar/sync", null, 401, { method: "POST", body: JSON.stringify({}) })
  await expectOneOf("/api/telegram/webhook", null, [401, 503], { method: "POST", body: JSON.stringify({ update_id: 1 }) })

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
