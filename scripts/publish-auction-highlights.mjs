#!/usr/bin/env node

import fs from "node:fs"
import https from "node:https"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { PrismaClient } from "@prisma/client"

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
const dryRun = process.argv.includes("--dry-run")
const explicitLimit = Number(process.argv[process.argv.indexOf("--limit") + 1])
const limit = Number.isInteger(explicitLimit) ? Math.min(Math.max(explicitLimit, 1), 10) : Math.min(Math.max(Number(process.env.TELEGRAM_AUCTION_POST_LIMIT || 3), 1), 10)
const maxAgeHours = Math.min(Math.max(Number(process.env.TELEGRAM_AUCTION_MAX_AGE_HOURS || 72), 1), 720)
const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
const configuredChatIds = [...new Set((process.env.TELEGRAM_AUCTION_CHAT_IDS || "").split(",").map((value) => value.trim()).filter(Boolean))]
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://lewheel.ru").replace(/\/$/, "")
const botUsername = (process.env.TELEGRAM_BOT_USERNAME || process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "lewheelbot").replace(/^@/, "").trim()

const COUNTRY_LABELS = { CN: "Китай", KR: "Корея", JP: "Япония", US: "США", DE: "Европа" }
const FUEL_LABELS = { GASOLINE: "бензин", DIESEL: "дизель", ELECTRIC: "электро", HYBRID: "гибрид", GAS: "газ" }
const SOURCE_LABELS = { YOUXINPAI: "YouXinPai", IAUTOS: "iAutos", ENCAR: "Encar", KCAR: "K Car", BOBAEDREAM: "Bobaedream", GOONET: "Goo-net", CARSENSOR: "CarSensor", BEFORWARD: "BE FORWARD", CARVAGO: "Carvago", AUTOSALE: "AutoSale", MOBILE_DE: "mobile.de" }

function safeJson(value) {
  try { return typeof value === "string" ? JSON.parse(value) : value } catch { return null }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
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

function equipmentLabels(value) {
  const equipment = safeJson(value)
  return (Array.isArray(equipment?.items) ? equipment.items : [])
    .filter((item) => item?.available && typeof item.label === "string")
    .slice(0, 5)
    .map((item) => item.label)
}

function sourceSpec(value, label) {
  const line = String(value || "").split(/\r?\n|;/).find((entry) => entry.trim().toLocaleLowerCase("ru-RU").startsWith(`${label.toLocaleLowerCase("ru-RU")}:`))
  return line ? line.slice(line.indexOf(":") + 1).trim() : null
}

function signalForPrice(price, countryMedian) {
  if (!countryMedian) return { label: "Свежий лот", ratio: null }
  const ratio = price / countryMedian
  if (ratio <= 0.82) return { label: "Отличная цена", ratio }
  if (ratio <= 0.95) return { label: "Хорошая цена", ratio }
  return { label: "Рыночная цена", ratio }
}

export function buildAuctionCaption(listing, countryMedian) {
  const signal = signalForPrice(listing.finalPrice, countryMedian)
  const damage = inspectionCounts(listing.conditionInfo)
  const equipment = equipmentLabels(listing.equipment)
  const details = [
    `${listing.year} г.`,
    listing.mileage != null ? `${Math.round(listing.mileage).toLocaleString("ru-RU")} км` : null,
    listing.engineVolume ? `${(listing.engineVolume / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} л` : null,
    listing.power ? `${listing.power} л.с.` : null,
    FUEL_LABELS[listing.fuelType] || null,
  ].filter(Boolean).join(" · ")
  const source = [SOURCE_LABELS[listing.source] || listing.source, listing.lotNumber ? `лот ${listing.lotNumber}` : null, COUNTRY_LABELS[listing.country] || listing.country].filter(Boolean).join(" · ")
  const sourcePrice = sourceSpec(listing.specsRu, "Ориентир цены источника") || sourceSpec(listing.specsRu, "База предварительного расчёта")
  const openingBid = sourceSpec(listing.specsRu, "Стартовая ставка")
  const priceNote = signal.ratio && signal.ratio < 1 ? ` · на ${Math.round((1 - signal.ratio) * 100)}% ниже медианы страны` : ""
  const lines = [
    `🔥 <b>${escapeHtml(signal.label)}</b>`,
    `<b>${escapeHtml(`${listing.make} ${listing.model}`)}</b>`,
    `💰 <b>${listing.finalPrice.toLocaleString("ru-RU")} ₽</b>${priceNote}`,
    details ? `📋 ${escapeHtml(details)}` : null,
    `🏷 ${escapeHtml(source)}`,
    sourcePrice ? `📊 Источник: ${escapeHtml(sourcePrice)}${openingBid ? ` · старт ${escapeHtml(openingBid)}` : ""}` : null,
    damage.notes ? `🛠 Осмотр: ${damage.serious} ${pluralRu(damage.serious, "серьёзный дефект", "серьёзных дефекта", "серьёзных дефектов")} · ${damage.notes} ${pluralRu(damage.notes, "замечание", "замечания", "замечаний")}` : null,
    equipment.length ? `✨ Оснащение: ${escapeHtml(equipment.join(", "))}` : null,
    "ℹ️ Цена предварительная. Итог подтвердим после проверки лота, доставки и документов.",
    `🌐 <a href="${siteUrl}">LeWheel</a>${botUsername ? ` · @${escapeHtml(botUsername)}` : ""}`,
  ].filter(Boolean)
  while (lines.join("\n").length > 1000 && lines.length > 6) lines.splice(lines.length - 2, 1)
  return lines.join("\n")
}

function parseImages(listing) {
  const values = safeJson(listing.images)
  return [...new Set([listing.imageUrl, ...(Array.isArray(values) ? values : [])].filter((value) => typeof value === "string" && /^https:\/\//i.test(value)))]
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

async function publish(listing, chatId, countryMedian) {
  const url = `${siteUrl}/auctions/${listing.id}`
  const replyMarkup = { inline_keyboard: [[{ text: "🚘 Посмотреть автомобиль", url }]] }
  const caption = buildAuctionCaption(listing, countryMedian)
  const photo = parseImages(listing)[0]
  let message
  if (photo) {
    message = await telegramApi("sendPhoto", { chat_id: chatId, photo, caption, parse_mode: "HTML", show_caption_above_media: true, reply_markup: replyMarkup })
      .catch(() => telegramApi("sendMessage", { chat_id: chatId, text: caption, parse_mode: "HTML", disable_web_page_preview: false, reply_markup: replyMarkup }))
  } else {
    message = await telegramApi("sendMessage", { chat_id: chatId, text: caption, parse_mode: "HTML", disable_web_page_preview: false, reply_markup: replyMarkup })
  }
  await prisma.auctionTelegramPost.create({ data: { auctionListingId: listing.id, chatId, messageId: message?.message_id ? String(message.message_id) : null } })
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
  if (!dryRun && !botToken) {
    console.log("[auction-telegram] skipped: configure TELEGRAM_BOT_TOKEN")
    return
  }

  const chatIds = await filterAdminChats(await resolveChatIds())
  if (!dryRun && chatIds.length === 0) {
    console.log("[auction-telegram] skipped: no registered chats where the bot is an administrator")
    return
  }

  const listings = await prisma.auctionListing.findMany({
    where: { status: "ACTIVE", finalPrice: { gt: 0 }, imageUrl: { not: null }, createdAt: { gte: new Date(Date.now() - maxAgeHours * 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    take: 500,
  })
  const medians = new Map([...new Set(listings.map((listing) => listing.country))].map((country) => [country, median(listings.filter((listing) => listing.country === country).map((listing) => listing.finalPrice))]))
  const posted = dryRun || chatIds.length === 0 ? [] : await prisma.auctionTelegramPost.findMany({ where: { auctionListingId: { in: listings.map((listing) => listing.id) }, chatId: { in: chatIds } }, select: { auctionListingId: true, chatId: true } })
  const postedKeys = new Set(posted.map((item) => `${item.auctionListingId}:${item.chatId}`))
  const candidates = listings
    .map((listing) => ({ listing, signal: signalForPrice(listing.finalPrice, medians.get(listing.country)) }))
    .filter(({ signal }) => signal.ratio == null || signal.ratio <= 0.95)
    .sort((left, right) => (left.signal.ratio || 1) - (right.signal.ratio || 1))
    .slice(0, limit)

  if (dryRun) {
    console.log(JSON.stringify(candidates.map(({ listing }) => ({ id: listing.id, photo: parseImages(listing)[0] || null, caption: buildAuctionCaption(listing, medians.get(listing.country)) })), null, 2))
    return
  }

  let sent = 0
  for (const { listing } of candidates) {
    for (const chatId of chatIds) {
      if (postedKeys.has(`${listing.id}:${chatId}`)) continue
      await publish(listing, chatId, medians.get(listing.country))
      sent += 1
    }
  }
  console.log(`[auction-telegram] sent ${sent} post(s) for ${candidates.length} highlighted lot(s)`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`[auction-telegram] ${error instanceof Error ? error.message : error}`)
    process.exitCode = 1
  }).finally(() => prisma.$disconnect())
}
