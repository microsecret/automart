#!/usr/bin/env node

import fs from "node:fs"
import https from "node:https"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PrismaClient } from "@prisma/client"
import {
  auctionHighlightMinimumFields,
  auctionHighlightReadiness,
  parseAuctionHighlightListingId,
} from "../src/lib/auction-telegram-highlight.mjs"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const envPath = path.join(projectRoot, ".env")
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (!match || process.env[match[1]]) continue
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "")
  }
}

const prisma = new PrismaClient()

function getArgValue(flag) {
  const index = process.argv.indexOf(flag)
  if (index < 0 || index + 1 >= process.argv.length) return null
  return process.argv[index + 1]
}

const dryRun = process.argv.includes("--dry-run")
const forceListing = process.argv.includes("--force")
const explicitListingArg = getArgValue("--listing")
const explicitListingId = parseAuctionHighlightListingId(explicitListingArg)
const explicitLimit = Number(getArgValue("--limit"))
const limit = Number.isInteger(explicitLimit) ? Math.min(Math.max(explicitLimit, 1), 10) : Math.min(Math.max(Number(process.env.TELEGRAM_AUCTION_POST_LIMIT || 3), 1), 10)
const maxAgeHours = Math.min(Math.max(Number(process.env.TELEGRAM_AUCTION_MAX_AGE_HOURS || 72), 1), 720)
const freshnessBoundary = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000)
// Дешёвый лот в ленте обесценивает подборку: подписчик приходит за машинами,
// которые имеет смысл везти, а не за самой низкой строкой прайса.
const minFinalPrice = Math.max(Number(process.env.TELEGRAM_AUCTION_MIN_FINAL_PRICE || 1_000_000), 0)
// Нижняя граница отношения к медиане отсекает подозрительно дешёвые записи:
// цена сильно ниже рынка обычно означает битый лот или ошибку источника.
// Значение по умолчанию намеренно ниже `maxGreatDealRatio`, иначе диапазон
// отбора становится пустым и лента молча перестаёт публиковаться.
const minMedianRatio = Math.min(Math.max(Number(process.env.TELEGRAM_AUCTION_MIN_MEDIAN_RATIO || 0.35), 0), 0.95)
const maxGreatDealRatio = Math.min(Math.max(Number(process.env.TELEGRAM_AUCTION_MAX_PRICE_RATIO || 0.88), 0.01), 0.99)
if (minMedianRatio > maxGreatDealRatio) {
  // Перевёрнутый диапазон делает отбор невыполнимым, а лента при этом молчит
  // без единой ошибки. Такую конфигурацию лучше остановить на старте.
  console.error(`TELEGRAM_AUCTION_MIN_MEDIAN_RATIO (${minMedianRatio}) must not exceed TELEGRAM_AUCTION_MAX_PRICE_RATIO (${maxGreatDealRatio})`)
  process.exit(1)
}
const maxSeriousDefects = Math.max(Number(process.env.TELEGRAM_AUCTION_MAX_SERIOUS_DEFECTS || 1), 0)
const maxInspectionNotes = Math.max(Number(process.env.TELEGRAM_AUCTION_MAX_INSPECTION_NOTES || 30), 0)
const minCompletenessFields = auctionHighlightMinimumFields(process.env.TELEGRAM_AUCTION_MIN_COMPLETENESS_FIELDS)
const postDelayMinMs = Math.min(Math.max(Number(process.env.TELEGRAM_AUCTION_POST_DELAY_MIN_MS || 10_000), 1_000), 90_000)
const postDelayMaxMs = Math.min(Math.max(Number(process.env.TELEGRAM_AUCTION_POST_DELAY_MAX_MS || 15_000), postDelayMinMs), 120_000)
const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
const configuredChatIds = [...new Set((process.env.TELEGRAM_AUCTION_CHAT_IDS || "").split(",").map((value) => value.trim()).filter(Boolean))]
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://lewheel.ru").replace(/\/$/, "")
const botUsername = (process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "lewheelbot").replace(/^@/, "").trim()

const COUNTRY_LABELS = { CN: "Китай", KR: "Корея", JP: "Япония", US: "США", DE: "Европа" }
const FUEL_LABELS = { GASOLINE: "бензин", DIESEL: "дизель", ELECTRIC: "электро", HYBRID: "гибрид", GAS: "газ" }
const BODY_LABELS = { SEDAN: "седан", SUV: "кроссовер", HATCHBACK: "хэтчбек", COUPE: "купе", PICKUP: "пикап", WAGON: "универсал", MINIVAN: "минивэн" }
const DRIVE_LABELS = { FWD: "передний", RWD: "задний", AWD: "полный", FOUR_WD: "полный" }
const TRANSMISSION_LABELS = { MANUAL: "механика", AUTOMATIC: "автомат", VARIATOR: "вариатор", ROBOTIC: "робот", CVT: "вариатор", DCT: "робот" }
const SOURCE_LABELS = { YOUXINPAI: "YouXinPai", IAUTOS: "iAutos", ENCAR: "Encar", KCAR: "K Car", BOBAEDREAM: "Bobaedream", GOONET: "Goo-net", CARSENSOR: "CarSensor", BEFORWARD: "BE FORWARD", CARVAGO: "Carvago", AUTOSALE: "AutoSale", MOBILE_DE: "mobile.de" }
const SOURCE_KEY_LABELS = new Set([
  "Ориентир цены источника",
  "База предварительного расчёта",
  "Стартовая ставка",
  "Количество ключей",
  "Количество мест",
  "Экологический стандарт",
  "Серьёзные дефекты отчёта",
  "Замечания осмотра",
  "Местонахождение",
])

function safeJson(value) {
  try { return typeof value === "string" ? JSON.parse(value) : value } catch { return null }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function normalizeText(value) {
  return value ? String(value).replace(/\s+/g, " ").trim() : null
}

function trimToLimit(lines, maxLength = 980) {
  const result = []
  let total = 0
  for (const line of lines) {
    // Пустая строка — это разделитель абзаца, а не отсутствующее значение,
    // поэтому она сохраняется. Ведущие и парные разделители отбрасываются,
    // чтобы обрезанное сообщение не заканчивалось пустотой.
    if (line === "" && (result.length === 0 || result[result.length - 1] === "")) continue
    const withLine = result.length === 0 ? line : `\n${line}`
    if (total + withLine.length > maxLength) break
    result.push(line)
    total += withLine.length
  }
  while (result.length && result[result.length - 1] === "") result.pop()
  return result
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

function pluralRu(value, one, few, many) {
  const mod100 = Math.abs(value) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 19) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

function inspectionCounts(conditionValue) {
  const condition = safeJson(conditionValue)
  const sections = Array.isArray(condition?.damageReport?.sections) ? condition.damageReport.sections : []
  let notes = 0
  let serious = 0
  for (const section of sections) {
    for (const item of Array.isArray(section?.items) ? section.items : []) {
      notes += 1
      if (Array.isArray(item?.kinds) && item.kinds.includes("SERIOUS")) serious += 1
    }
  }
  return { notes, serious }
}

function parseSourceSpecs(value) {
  if (!normalizeText(value)) return []
  return String(value).split(/[;\n]+/).flatMap((item) => {
    const separator = item.indexOf(":")
    if (separator <= 0) return []
    const label = normalizeText(item.slice(0, separator))
    const detail = normalizeText(item.slice(separator + 1))
    if (!label || !detail) return []
    if (detail === "Не опубликовано источником") return []
    return { label, detail }
  }).filter(Boolean)
}

function equipmentLabels(value) {
  const equipment = safeJson(value)
  return (Array.isArray(equipment?.items) ? equipment.items : [])
    .filter((item) => item?.available && typeof item.label === "string")
    .slice(0, 6)
    .map((item) => item.label)
}

function sourceSpec(value, label) {
  const normalized = normalizeText(label)?.toLocaleLowerCase("ru-RU")
  const line = normalized ? String(value || "").split(/\r?\n|;/).find((entry) => {
    const candidate = normalizeText(entry)?.toLocaleLowerCase("ru-RU")
    return candidate?.startsWith(`${normalized}:`)
  }) : null
  return line ? line.slice(line.indexOf(":") + 1).trim() : null
}

function inspectionRows(conditionValue, sourceValue) {
  const condition = safeJson(conditionValue)
  const notes = Array.isArray(condition?.damageReport?.sections)
    ? condition.damageReport.sections.flatMap((section) => Array.isArray(section?.items) ? section.items : []).length
    : 0
  const serious = Array.isArray(condition?.damageReport?.sections)
    ? condition.damageReport.sections.flatMap((section) => Array.isArray(section?.items) ? section.items : [])
      .filter((item) => Array.isArray(item?.kinds) && item.kinds.includes("SERIOUS")).length
    : 0
  const remarks = notes > 0 ? `${notes} ${pluralRu(notes, "замечание", "замечания", "замечаний")}` : null
  const seriousText = serious > 0 ? `${serious} ${pluralRu(serious, "серьёзный дефект", "серьёзных дефекта", "серьёзных дефектов")}` : "Серьёзных дефектов не найдено"
  return { notes, serious, remarks, seriousText, sourceRows: parseSourceSpecs(sourceValue).filter((row) => SOURCE_KEY_LABELS.has(row.label)) }
}

function signalForPrice(price, countryMedian) {
  if (!countryMedian) return { label: "Свежий лот", ratio: null, saving: null }
  const ratio = price / countryMedian
  // Выгода считается от медианы своей страны, поэтому сравнение идёт с
  // сопоставимыми лотами, а не со всем каталогом сразу.
  const saving = Math.max(0, Math.round(countryMedian - price))
  if (ratio <= 0.82) return { label: "Отличная цена", ratio, saving }
  if (ratio <= 0.95) return { label: "Хорошая цена", ratio, saving }
  return { label: "Рыночная цена", ratio, saving: null }
}

function buildAuctionCaption(listing, countryMedian) {
  const signal = signalForPrice(listing.finalPrice, countryMedian)
  const condition = inspectionRows(listing.conditionInfo, listing.specsRu)
  const equipment = equipmentLabels(listing.equipment)
  const details = [
    listing.year ? `${listing.year} г.` : null,
    listing.mileage != null ? `${Math.round(listing.mileage).toLocaleString("ru-RU")} км` : null,
    listing.color ? listing.color : null,
    listing.bodyType ? BODY_LABELS[listing.bodyType] || listing.bodyType : null,
    listing.fuelType ? FUEL_LABELS[listing.fuelType] || listing.fuelType : null,
    listing.transmission ? TRANSMISSION_LABELS[listing.transmission] || listing.transmission : null,
    listing.driveType ? DRIVE_LABELS[listing.driveType] || listing.driveType : null,
    listing.engineVolume != null ? `${Math.round(listing.engineVolume).toLocaleString("ru-RU")} см³` : null,
    listing.power != null ? `${Math.round(listing.power).toLocaleString("ru-RU")} л.с.` : null,
  ].filter(Boolean).join(" · ")
  const source = [SOURCE_LABELS[listing.source] || listing.source, listing.lotNumber ? `лот ${listing.lotNumber}` : null, COUNTRY_LABELS[listing.country] || listing.country].filter(Boolean).join(" · ")
  const sourcePrice = sourceSpec(listing.specsRu, "Ориентир цены источника")
  const startingBid = sourceSpec(listing.specsRu, "Стартовая ставка")
  const preCalc = sourceSpec(listing.specsRu, "База предварительного расчёта")
  // Выгода показывается только когда она посчитана от медианы и заметна:
  // «дешевле на 8 000 ₽» при цене в три миллиона выглядит как натяжка.
  const savingText = signal.saving && signal.saving >= 100_000
    ? `дешевле медианы по стране на ${signal.saving.toLocaleString("ru-RU")} ₽`
    : null
  const inspectionText = condition.serious > 0
    ? `${condition.seriousText} · ${condition.remarks || "без замечаний"}`
    : condition.remarks
      ? `серьёзных дефектов нет · ${condition.remarks}`
      : "серьёзных дефектов в отчёте нет"

  const lines = [
    `🚘 <b>${escapeHtml(`${listing.make} ${listing.model}`)}</b>${listing.year ? ` <b>${listing.year}</b>` : ""}`,
    `💰 <b>${listing.finalPrice.toLocaleString("ru-RU")} ₽</b> — ${escapeHtml(signal.label.toLowerCase())}`,
    savingText ? `📉 ${escapeHtml(savingText)}` : null,
    "",
    details ? `📋 ${escapeHtml(details)}` : null,
    `🛠 Осмотр: ${escapeHtml(inspectionText)}`,
    ...condition.sourceRows.slice(0, 3).map((row) => `• ${escapeHtml(row.label)}: ${escapeHtml(row.detail)}`),
    equipment.length ? `✨ ${escapeHtml(equipment.join(", "))}` : null,
    "",
    `🏷 ${escapeHtml(source)}`,
    listing.location ? `📍 ${escapeHtml(listing.location)}` : null,
    sourcePrice ? `📊 Источник: ${escapeHtml(sourcePrice)}${startingBid ? ` · старт ${escapeHtml(startingBid)}` : ""}` : null,
    preCalc ? `🧮 База расчёта: ${escapeHtml(preCalc)}` : null,
    "",
    "🧾 Цена лота без доставки и таможни — точный расчёт под ключ считаем по запросу",
    `🌐 <a href="${siteUrl}">LeWheel</a>${botUsername ? ` · @${escapeHtml(botUsername)}` : ""}`,
  ].filter((line) => line !== null)

  return trimToLimit(lines).join("\n")
}

function parseImages(listing) {
  const values = safeJson(listing.images)
  return [...new Set([listing.imageUrl, ...(Array.isArray(values) ? values : [])].filter((value) => typeof value === "string" && /^https:\/\//i.test(value)))]
}

function buildReplyMarkup(listing) {
  const campaign = "utm_source=telegram&utm_medium=auction_highlight&utm_campaign=auction_feed"
  const trackedUrl = (path, content) => `${siteUrl}${path}${path.includes("?") ? "&" : "?"}${campaign}&utm_content=${encodeURIComponent(content)}`
  const listingUrl = trackedUrl(`/auctions/${listing.id}`, "view_lot")
  const countryLabel = COUNTRY_LABELS[listing.country] || listing.country
  const rows = [
    [{ text: "🚘 Смотреть лот", url: listingUrl }],
    [
      { text: "🧮 Расчёт под ключ", url: `${trackedUrl(`/auctions/${listing.id}`, "calculator")}#calculator` },
      { text: `🌍 Ещё из «${countryLabel}»`, url: trackedUrl(`/auctions?country=${encodeURIComponent(listing.country)}`, "country_catalog") },
    ],
    // Лента приводит не только покупателей: продавцу нужен видимый вход в
    // подачу объявления, иначе он уходит со страницы чужого лота.
    [{ text: "➕ Разместить своё объявление", url: trackedUrl("/listings/create/vehicle", "create_listing") }],
  ]
  if (botUsername) {
    rows.push([{ text: "🤖 Открыть в Mini App", url: `https://t.me/${botUsername}?startapp=auctions` }])
  }
  return { inline_keyboard: rows }
}

function telegramApi(method, payload) {
  const requestBody = JSON.stringify(payload)
  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: "api.telegram.org",
      family: 4,
      port: 443,
      path: `/bot${botToken}/${method}`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(requestBody) },
      timeout: 25_000,
    }, (response) => {
      let responseBody = ""
      response.setEncoding("utf8")
      response.on("data", (chunk) => { responseBody += chunk })
      response.on("end", () => {
        const body = (() => { try { return JSON.parse(responseBody) } catch { return null } })()
        if ((response.statusCode || 500) >= 400 || !body?.ok) return reject(new Error(body?.description || `Telegram API ${response.statusCode || 500}`))
        resolve(body.result)
      })
    })
    request.on("error", reject)
    request.on("timeout", () => request.destroy(new Error(`Telegram API ${method} timed out`)))
    request.end(requestBody)
  })
}

function shuffleInPlace(items) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const current = copy[index]
    copy[index] = copy[randomIndex]
    copy[randomIndex] = current
  }
  return copy
}

function sendDelayMs() {
  const min = Math.min(postDelayMinMs, postDelayMaxMs)
  const max = Math.max(postDelayMinMs, postDelayMaxMs)
  if (max <= 0) return 0
  return min + Math.floor(Math.random() * (max - min + 1))
}

function wait(ms) {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => { setTimeout(resolve, ms) })
}

async function publish(listing, chatId, countryMedian) {
  const caption = buildAuctionCaption(listing, countryMedian)
  const photo = parseImages(listing)[0]
  const replyMarkup = buildReplyMarkup(listing)
  let message
  if (photo) {
    message = await telegramApi("sendPhoto", {
      chat_id: chatId,
      photo,
      caption,
      parse_mode: "HTML",
      show_caption_above_media: true,
      disable_notification: true,
      reply_markup: replyMarkup,
    }).catch(() => telegramApi("sendMessage", {
      chat_id: chatId,
      text: caption,
      parse_mode: "HTML",
      disable_web_page_preview: false,
      disable_notification: true,
      reply_markup: replyMarkup,
    }))
  } else {
    message = await telegramApi("sendMessage", {
      chat_id: chatId,
      text: caption,
      parse_mode: "HTML",
      disable_web_page_preview: false,
      disable_notification: true,
      reply_markup: replyMarkup,
    })
  }
  try {
    await prisma.auctionTelegramPost.create({ data: { auctionListingId: listing.id, chatId, messageId: message?.message_id ? String(message.message_id) : null } })
  } catch (error) {
    // Avoid re-sending loop breaks if a duplicate for this chat was created in parallel.
    const messageText = error instanceof Error ? error.message : ""
    if (!/Unique constraint failed/i.test(messageText)) throw error
  }
}

async function resolveChatIds() {
  const registered = await prisma.telegramChat.findMany({
    where: { active: true, marketingEnabled: true },
    select: { id: true },
  })
  return [...new Set([...configuredChatIds, ...registered.map((chat) => chat.id)])]
}

async function filterAdminChats(chatIds) {
  if (dryRun || !botToken || chatIds.length === 0) return chatIds
  const bot = await telegramApi("getMe", {})
  const checks = await Promise.all(chatIds.map(async (chatId) => {
    const member = await telegramApi("getChatMember", { chat_id: chatId, user_id: bot.id }).catch(() => null)
    return member && (member.status === "administrator" || member.status === "creator") ? chatId : null
  }))
  return checks.filter(Boolean)
}

async function main() {
  if (explicitListingArg && !explicitListingId) {
    console.log(`[auction-telegram] skipped: invalid --listing value "${explicitListingArg}", use UUID or /auctions/<id> URL`)
    return
  }

  if (!dryRun && !botToken) {
    console.log("[auction-telegram] skipped: configure TELEGRAM_BOT_TOKEN")
    return
  }

  const chatIds = await filterAdminChats(await resolveChatIds())
  if (!dryRun && chatIds.length === 0) {
    console.log("[auction-telegram] skipped: no registered chats where the bot is an administrator")
    return
  }

  // Скрытый лот нельзя рекламировать: и ручное решение администратора, и
  // автоматический карантин качества должны убирать карточку из рассылки так
  // же, как они убирают её из публичного каталога.
  const where = explicitListingId
    ? { id: explicitListingId, status: "ACTIVE", adminHiddenAt: null, finalPrice: { gt: 0 }, imageUrl: { not: null } }
    : { status: "ACTIVE", adminHiddenAt: null, finalPrice: { gt: 0 }, imageUrl: { not: null }, createdAt: { gte: freshnessBoundary } }
  const listings = await prisma.auctionListing.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
  })
  if (!listings.length) {
    console.log(`[auction-telegram] no matching lots found${explicitListingId ? ` for listing ${explicitListingId}` : ""}`)
    return
  }

  const medianListings = explicitListingId && listings[0]
    ? await prisma.auctionListing.findMany({
      where: {
        country: listings[0].country,
        status: "ACTIVE",
        adminHiddenAt: null,
        finalPrice: { gt: 0 },
        sourceLastSeenAt: { gte: freshnessBoundary },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    })
    : listings
  const medians = new Map([...new Set(medianListings.map((listing) => listing.country))].map((country) => [
    country,
    median(medianListings.filter((listing) => listing.country === country).map((listing) => listing.finalPrice)),
  ]))
  const posted = dryRun || chatIds.length === 0 ? [] : await prisma.auctionTelegramPost.findMany({
    where: { auctionListingId: { in: listings.map((listing) => listing.id) }, chatId: { in: chatIds } },
    select: { auctionListingId: true, chatId: true },
  })
  const postedKeys = new Set(posted.map((item) => `${item.auctionListingId}:${item.chatId}`))
  const rankedCandidates = listings
    .map((listing) => ({
      listing,
      signal: signalForPrice(listing.finalPrice, medians.get(listing.country)),
      damage: inspectionCounts(listing.conditionInfo),
      readiness: auctionHighlightReadiness(listing, minCompletenessFields),
    }))
    .filter(({ listing, signal, damage, readiness }) => {
      if (listing.finalPrice < minFinalPrice) return false
      if (!signal.ratio) return false
      if (signal.ratio < minMedianRatio) return false
      if (signal.ratio > maxGreatDealRatio && !(explicitListingId && forceListing)) return false
      if (damage.serious > maxSeriousDefects) return false
      if (damage.notes > maxInspectionNotes) return false
      if (!readiness.ready) return false
      return true
    })
    .sort((left, right) => (left.signal.ratio || 1) - (right.signal.ratio || 1))

  // Внутри одной страны лоты часто идут плотной группой по цене, поэтому
  // прямая выборка «лучших» превращает подборку в ленту одного источника.
  // Чередование сохраняет порядок выгодности внутри страны, но показывает
  // подписчику разные направления.
  const rankedByCountry = new Map()
  for (const candidate of rankedCandidates) {
    const country = candidate.listing.country
    const bucket = rankedByCountry.get(country)
    if (bucket) bucket.push(candidate)
    else rankedByCountry.set(country, [candidate])
  }
  const diversifiedCandidates = []
  while (rankedByCountry.size) {
    for (const [country, bucket] of [...rankedByCountry.entries()]) {
      diversifiedCandidates.push(bucket.shift())
      if (!bucket.length) rankedByCountry.delete(country)
    }
  }

  if (!rankedCandidates.length) {
    console.log("[auction-telegram] no lots satisfy configured filters")
    return
  }

  if (dryRun) {
    console.log(JSON.stringify(diversifiedCandidates.slice(0, limit).map(({ listing, signal, readiness }) => ({
      id: listing.id,
      photo: parseImages(listing)[0] || null,
      caption: buildAuctionCaption(listing, medians.get(listing.country)),
      priceSignal: signal,
      readiness,
    })), null, 2))
    return
  }

  let sent = 0
  let highlightedLots = 0
  for (const chatId of chatIds) {
    const candidatesPool = diversifiedCandidates
      .filter(({ listing }) => forceListing || !postedKeys.has(`${listing.id}:${chatId}`))
    const candidates = (explicitListingId || forceListing)
      ? candidatesPool.slice(0, limit)
      : shuffleInPlace(candidatesPool).slice(0, limit)

    highlightedLots = Math.max(highlightedLots, candidates.length)
    for (const [index, { listing }] of candidates.entries()) {
      await publish(listing, chatId, medians.get(listing.country))
      sent += 1
      if (index < candidates.length - 1) {
        const delay = sendDelayMs()
        if (delay > 0) await wait(delay)
      }
    }
  }

  console.log(`[auction-telegram] sent ${sent} post(s); up to ${highlightedLots} fresh highlighted lot(s) per chat`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[auction-telegram] ${error instanceof Error ? error.message : error}`)
    process.exitCode = 1
  }).finally(() => prisma.$disconnect())
}
