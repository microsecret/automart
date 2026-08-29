/**
 * Рассылка утренней сводки по топливу в чаты сети.
 *
 * Карта работает, но о ней узнают единицы. В чатах сети сто пятнадцать
 * тысяч подписчиков — те самые водители, которым сводка нужна каждое
 * утро, и они уже там сидят.
 *
 * Сводка приносит пользу сама по себе: человек читает и уже знает, куда
 * ехать. Открывает карту, когда нужны подробности. Так сервис входит в
 * привычку, а не воспринимается рекламой.
 *
 * Сборка текста — в fuel-digest-post: то, что уходит тысячам людей,
 * проверяется тестами отдельно от базы и сети.
 */

import { prisma } from "@/lib/prisma"
import { getTelegramBotUsername } from "@/lib/telegram"
import { absoluteUrl } from "@/lib/site-url"
import { sendChatPost } from "@/lib/telegram-post-sender"
import { buildFuelDigest, MAX_DIGEST_STATIONS, type DigestStation } from "@/lib/fuel-digest-post"
import { cityFromChatTitle } from "@/lib/fuel-invite-post"
import { AVAILABILITY_FUEL_LABELS, isFresh, type AvailabilityFuel } from "@/lib/fuel-availability"

/**
 * Не чаще раза в сутки на чат.
 *
 * Сводка утренняя: вторая за день ничего не добавляет, а чат превращает
 * в ленту уведомлений, из которой выходят.
 */
const CHAT_INTERVAL_MS = 20 * 60 * 60 * 1000

/**
 * За какой срок берём отметки.
 *
 * Двенадцать часов: утренняя сводка должна включать вчерашний вечер —
 * если топливо привезли в семь вечера, к утру оно, скорее всего, ещё
 * есть. Более старое в сводку не идёт: оно вводит в заблуждение.
 */
const WINDOW_MS = 12 * 60 * 60 * 1000

export type DigestResult = {
  chats: number
  sent: number
  skipped: number
  failed: number
}

/**
 * Рассылает сводку по чатам, где сегодня не слали.
 *
 * Город берётся из названия чата, заправки — из отметок за половину
 * суток. Общий чат страны пропускается: сводка «по всей России»
 * бессмысленна, человеку нужен его город.
 */
export async function broadcastFuelDigest(): Promise<DigestResult> {
  const result: DigestResult = { chats: 0, sent: 0, skipped: 0, failed: 0 }

  const chats = await prisma.telegramChat.findMany({
    where: { active: true, marketingEnabled: true },
    select: { id: true, title: true },
  })
  if (chats.length === 0) return result

  const now = new Date()
  const botUsername = getTelegramBotUsername() ?? undefined
  const siteUrl = absoluteUrl("/")
  const since = new Date(now.getTime() - WINDOW_MS)

  /* Отметки за половину суток разом: по чатам их всё равно разбирать в
     памяти, а отдельный запрос на каждый город — одиннадцать походов в
     базу за теми же строками. */
  const reports = await prisma.fuelAvailabilityReport.findMany({
    where: { createdAt: { gte: since }, state: "YES" },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: { stationId: true, stationName: true, city: true, fuel: true, createdAt: true },
  })

  if (reports.length === 0) {
    /* Отметок нет вовсе — рассылать нечего. Сводка «сегодня никто не
       отмечал» в одиннадцать чатов подряд выглядит как признание, что
       сервисом не пользуются. */
    return result
  }

  const prices = await prisma.fuelPriceReport.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: { stationId: true, fuel: true, priceRub: true },
  })
  const priceByKey = new Map(prices.map((row) => [`${row.stationId}:${row.fuel}`, row.priceRub]))

  for (const chat of chats) {
    result.chats += 1

    const city = cityFromChatTitle(chat.title)
    if (!city) {
      /* Общий чат страны: сводка «по всей России» бессмысленна — человеку
         нужен его город, а не список из семи регионов. */
      result.skipped += 1
      continue
    }

    const recent = await prisma.fuelDigestPost.findFirst({
      where: { chatId: chat.id, publishedAt: { gt: new Date(now.getTime() - CHAT_INTERVAL_MS) } },
      select: { id: true },
    })
    if (recent) {
      result.skipped += 1
      continue
    }

    /* Заправки этого города. Город сохраняется вместе с отметкой, а
       сравнение нестрогое: в отметке он приходит из выбранного человеком
       списка, в названии чата написан по-своему — «Авторынок Казань» и
       «Казань» должны сойтись. */
    const cityKey = city.toLowerCase()
    const byStation = new Map<string, DigestStation>()

    for (const report of reports) {
      if (!isFresh(report.createdAt, now)) continue
      /* Отметки без города берём тоже: они сделаны до того, как поле
         появилось, и выбрасывать их — значит на первых порах слать
         пустые сводки. */
      if (report.city && !report.city.toLowerCase().includes(cityKey)) continue

      const existing = byStation.get(report.stationId)
      const label = AVAILABILITY_FUEL_LABELS[report.fuel as AvailabilityFuel] || report.fuel
      const price = priceByKey.get(`${report.stationId}:${report.fuel}`) ?? null

      if (existing) {
        if (!existing.fuels.includes(label)) existing.fuels.push(label)
        if (existing.priceKopecks === null && price !== null) existing.priceKopecks = price
        continue
      }

      byStation.set(report.stationId, {
        /* Название из отметки: без него в сводке стоял бы код вида
           «osm-node-123», по которому человек ничего не узнает. */
        name: report.stationName || "АЗС",
        fuels: [label],
        priceKopecks: price,
        minutesAgo: Math.max(1, Math.round((now.getTime() - report.createdAt.getTime()) / 60_000)),
      })
    }

    const stations = [...byStation.values()]
      .sort((left, right) => left.minutesAgo - right.minutesAgo)
      .slice(0, MAX_DIGEST_STATIONS)

    if (stations.length === 0) {
      result.skipped += 1
      continue
    }

    const post = buildFuelDigest({
      city,
      stations,
      reportsToday: reports.length,
      siteUrl,
      botUsername,
    })

    const messageId = await sendChatPost(
      chat.id,
      { photos: [], caption: post.text, buttons: post.buttons },
      { buttonsCaption: "Открыть:" },
    )

    if (!messageId) {
      result.failed += 1
      continue
    }

    await prisma.fuelDigestPost.create({ data: { chatId: chat.id, messageId } })
    result.sent += 1
  }

  return result
}
