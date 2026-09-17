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
import { CITY_COORDINATES } from "@/lib/cities"
import { buildNetworkPrices } from "@/lib/fuel-network-prices"
import { buildFuelPriceDigestPost } from "@/lib/fuel-price-digest-post"
import { toCitySlug } from "@/lib/fuel-city-slug"

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

  /* Раньше здесь стоял выход: нет отметок — нечего рассылать. Замер
     17 сентября 2026 показал, чем это обернулось: отметок семьдесят две
     за всё время и ноль за последние полсуток, а задача запускается
     каждое утро и каждый раз пишет в журнал {"chats":0,"sent":0}.
     Сводка молчала месяцами при ста пятнадцати тысячах подписчиков.

     Отметки остаются главным содержимым — они отвечают на вопрос «где
     сейчас налито», которого не знает ни один источник. Но когда их
     нет, вместо молчания уходит сводка цен: шестьдесят девять тысяч
     цен из источников обновляются каждые пятнадцать минут и отвечают
     на второй вопрос водителя — «где дешевле». */

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

    /* Отметок по городу нет — уходит сводка цен. Она не заменяет
       отметки: те говорят, где налито прямо сейчас, а цены — где
       дешевле. Но молчание не говорит ничего. */
    if (stations.length === 0) {
      const priceText = await buildCityPriceDigest(city)
      if (!priceText) {
        result.skipped += 1
        continue
      }

      const priceMessageId = await sendChatPost(
        chat.id,
        { photos: [], caption: priceText, buttons: [] },
      )
      if (!priceMessageId) {
        result.failed += 1
        continue
      }

      await prisma.fuelDigestPost.create({ data: { chatId: chat.id, messageId: priceMessageId } })
      result.sent += 1
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

/*
 * Радиус выборки вокруг центра города — тот же, что у витрины на
 * главной: поле `city` в базе источников содержит и «Трасса, Западная
 * Сибирь», по нему город не найти.
 */
const CITY_RADIUS_KM = 30

/** Марка, о которой сводка: самая ходовая. */
const DIGEST_FUEL = "AI95"
const DIGEST_FUEL_LABEL = "АИ-95"

/**
 * Сводка цен по сетям города или `null`, если сравнивать не с чем.
 *
 * Считается тем же кодом, что и витрина «Где заправиться» на главной:
 * иначе чат и сайт показывали бы разные числа об одном городе.
 */
async function buildCityPriceDigest(city: string): Promise<string | null> {
  const center = CITY_COORDINATES[city]
  if (!center) return null

  const latitudeDelta = CITY_RADIUS_KM / 111
  const longitudeDelta = CITY_RADIUS_KM / (111 * Math.cos(center.latitude * Math.PI / 180))

  const rows = await prisma.fuelStationImport.findMany({
    where: {
      latitude: { gte: center.latitude - latitudeDelta, lte: center.latitude + latitudeDelta },
      longitude: { gte: center.longitude - longitudeDelta, lte: center.longitude + longitudeDelta },
      prices: { some: { fuel: DIGEST_FUEL } },
    },
    select: {
      name: true,
      brand: true,
      prices: { where: { fuel: DIGEST_FUEL }, select: { fuel: true, priceRub: true } },
    },
    take: 4000,
  })

  const networks = buildNetworkPrices(rows.flatMap((row) =>
    row.prices.map((price) => ({
      name: row.name || row.brand || "",
      brand: row.brand,
      fuel: price.fuel,
      priceRub: price.priceRub,
    })),
  ))

  return buildFuelPriceDigestPost({
    city,
    fuelLabel: DIGEST_FUEL_LABEL,
    networks,
    mapUrl: absoluteUrl(`/services/fuel-map/${toCitySlug(city)}`),
  })
}
