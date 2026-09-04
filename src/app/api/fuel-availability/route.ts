import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { notifyFuelSubscribers } from "@/lib/fuel-subscription-notify"
import { broadcastFuelAppeared } from "@/lib/fuel-appeared-broadcast"
import { parseReportedPrice } from "@/lib/fuel-price-reports"
import {
  AVAILABILITY_FUEL_LABELS,
  STALE_WINDOW_MS,
  type AvailabilityFuel,
  isAvailabilityFuel,
  isAvailabilityState,
  isQueueLevel,
  summarizeAvailability,
} from "@/lib/fuel-availability"

export const dynamic = "force-dynamic"

/* Идентификатор точки приходит с карты и попадает в запрос к базе, поэтому
   принимается только тот формат, который карта действительно выдаёт. */
const STATION_ID_PATTERN = /^[a-z]+-[a-z]+-\d+$/i
const MAX_STATIONS_PER_REQUEST = 300

/**
 * Сколько отметок читать на выдачу.
 *
 * Наличие отмечают чаще цены, но окно у него сутки: больше тысячи отметок
 * за сутки по трёмстам точкам не бывает даже в дефицит.
 */
const REPORT_HISTORY_LIMIT = 1_000

function hashClientIp(ip: string) {
  return createHash("sha256").update(`fuel-availability:${ip}`).digest("hex").slice(0, 32)
}

function normalizeStationIds(raw: string | null) {
  if (!raw) return []
  return [...new Set(
    raw.split(",")
      .map((value) => value.trim())
      .filter((value) => STATION_ID_PATTERN.test(value)),
  )].slice(0, MAX_STATIONS_PER_REQUEST)
}

/** Отдаёт наличие топлива по запрошенным точкам карты. */
export async function GET(request: NextRequest) {
  const stationIds = normalizeStationIds(request.nextUrl.searchParams.get("stations"))
  if (!stationIds.length) return NextResponse.json({ stations: {} })

  const since = new Date(Date.now() - STALE_WINDOW_MS)

  const reports = await prisma.fuelAvailabilityReport.findMany({
    where: { stationId: { in: stationIds }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: REPORT_HISTORY_LIMIT,
    select: { stationId: true, fuel: true, state: true, queue: true, photo: true, comment: true, userId: true, createdAt: true },
  })

  const byStation = new Map<string, Array<{ fuel: string; state: string; queue: string | null; createdAt: Date }>>()
  for (const report of reports) {
    const bucket = byStation.get(report.stationId)
    if (bucket) bucket.push(report)
    else byStation.set(report.stationId, [report])
  }

  const stations: Record<string, ReturnType<typeof summarizeAvailability>> = {}
  for (const [stationId, bucket] of byStation) {
    const summary = summarizeAvailability(bucket)
    if (summary.length) stations[stationId] = summary
  }

  /* Живёт ли сервис — вопрос, который человек задаёт первым.

     Карта показывает точки из справочника, и новичок видит одинаковые
     метки, не понимая, отмечает тут кто-нибудь или он первый. Между тем
     отметки есть: за неделю их десятки. Сводка отвечает на этот вопрос
     цифрой, а не обещанием.

     Считаем по всей площадке, а не по видимому участку: человек в
     Челябинске должен видеть, что сервисом пользуются, даже если в его
     квартале сегодня тихо. */
  const dayAgo = new Date(Date.now() - 24 * 3_600_000)
  const [reportsToday, lastReport] = await Promise.all([
    prisma.fuelAvailabilityReport.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.fuelAvailabilityReport.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, stationName: true },
    }),
  ])

  return NextResponse.json({
    stations,
    activity: {
      reportsToday,
      lastReportAt: lastReport?.createdAt.toISOString() || null,
      lastStationName: lastReport?.stationName || null,
    },
  }, {
    /* Короче, чем у цен: наличие меняется за минуты, и минутный кэш здесь
       уже показывает вчерашний день. */
    headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=120" },
  })
}

/** Принимает отметку наличия от водителя. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id || null
  const ip = getClientIp(request)

  /* Отмечать наличие легче, чем цену: два нажатия вместо ввода числа, и
     человек по дороге отмечает несколько заправок. Поэтому предел выше,
     чем у цен, но анонимный всё равно строже — накрутка с одного адреса
     красит карту целиком. */
  const limit = rateLimit(`fuel-availability:${userId || ip}`, userId
    ? { windowMs: 60 * 60 * 1_000, maxRequests: 40 }
    : { windowMs: 60 * 60 * 1_000, maxRequests: 10 })
  if (!limit.success) {
    return NextResponse.json(
      { error: "Слишком много отметок подряд. Попробуйте позже." },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const body = await request.json().catch(() => null)
  const stationId = typeof body?.stationId === "string" ? body.stationId.trim() : ""
  const queue = body?.queue ?? null
  const latitude = Number(body?.latitude)
  const longitude = Number(body?.longitude)

  /* Отметки принимаются списком: человек стоит у табло, где все цены
     сразу, и вводить их по одной марке за раз — значит заставлять его
     открывать форму пять раз. За рулём он этого не сделает.

     Одиночная отметка превращается в список из одной: так продолжают
     работать прежние вызовы, включая отметку из бота, где кнопка шлёт
     ровно одну марку. */
  const rawEntries = Array.isArray(body?.entries)
    ? body.entries
    : [{ fuel: body?.fuel, state: body?.state, price: body?.price }]

  const entries: Array<{ fuel: AvailabilityFuel; state: "YES" | "NO"; price: number | null }> = []
  for (const raw of rawEntries) {
    if (!isAvailabilityFuel(raw?.fuel) || !isAvailabilityState(raw?.state)) continue
    entries.push({
      fuel: raw.fuel,
      state: raw.state,
      /* Цена только к «есть»: «нет 92 по 60 рублей» бессмысленно, а в
         согласованную цену такая отметка попала бы. */
      price: raw.state === "YES" ? parseReportedPrice(raw.price) : null,
    })
  }

  if (!STATION_ID_PATTERN.test(stationId)) {
    return NextResponse.json({ error: "Некорректная точка на карте" }, { status: 400 })
  }
  if (entries.length === 0) {
    return NextResponse.json({ error: "Отметьте хотя бы одну марку топлива" }, { status: 400 })
  }
  if (queue !== null && !isQueueLevel(queue)) {
    return NextResponse.json({ error: "Некорректная отметка очереди" }, { status: 400 })
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return NextResponse.json({ error: "Некорректные координаты точки" }, { status: 400 })
  }

  /* Снимок принимается только свой, из /uploads: без проверки в поле
     легла бы любая чужая ссылка, и карта показывала бы картинку с
     постороннего сайта под видом фотографии колонки. */
  const rawPhoto = typeof body?.photo === "string" ? body.photo.trim() : ""
  const photo = /^\/uploads\/[A-Za-z0-9._-]+$/.test(rawPhoto) ? rawPhoto : null

  /* Комментарий короткий: это подпись к снимку, а не сообщение. Длинный
     всё равно не поместится в карточке и превратит карту в переписку. */
  const comment = typeof body?.comment === "string" && body.comment.trim()
    ? body.comment.trim().slice(0, 200)
    : null

  /* Название и город сохраняются вместе с отметкой: точки живут в
     OpenStreetMap, а не у нас, и без них сводка по городу называла бы
     заправки кодами, а уведомление подписчику — просто «АЗС». */
  const stationNameRaw = typeof body?.stationName === "string" && body.stationName.trim()
    ? body.stationName.trim().slice(0, 120)
    : null
  const cityRaw = typeof body?.city === "string" && body.city.trim()
    ? body.city.trim().slice(0, 80)
    : null

  const ipHash = hashClientIp(ip)

  /* Состояние до отметки: подписчиков будим только на переходе «нет или
     неизвестно» → «есть». Иначе каждая отметка «есть 92» на заправке, где
     он и так весь день есть, слала бы уведомление всем подписчикам. */
  const beforeRows = await prisma.fuelAvailabilityReport.findMany({
    where: { stationId, createdAt: { gte: new Date(Date.now() - STALE_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { fuel: true, state: true, queue: true, photo: true, comment: true, userId: true, createdAt: true },
  })
  const before = summarizeAvailability(beforeRows)
  /* Какие марки были в наличии до отметки: подписчиков будим только на
     переходе «нет или неизвестно» → «есть». */
  const wasAvailable = new Set(
    before.filter((row) => row.state === "YES").map((row) => row.fuel),
  )

  /* Повторная отметка не заменяет прежнюю, а добавляется: у цены голос
     один и уточняется, а у наличия накопление подтверждений и есть суть —
     «есть 92, отметили пятеро» доверия заслуживает больше, чем одна
     отметка.

     От накрутки защищает предел частоты выше: одного человека он
     ограничивает сорока отметками в час на все заправки. */
  /* Отметки пишутся по одной на марку — так их и читает сводка. Очередь,
     снимок и комментарий относятся к заправке целиком, но хранятся при
     каждой записи: разносить их по отдельной таблице ради трёх полей
     значило бы усложнить чтение вдвое. */
  await prisma.fuelAvailabilityReport.createMany({
    data: entries.map((entry) => ({
      stationId,
      latitude,
      longitude,
      fuel: entry.fuel,
      state: entry.state,
      queue: entry.state === "YES" ? queue : null,
      photo,
      comment,
      stationName: stationNameRaw,
      city: cityRaw,
      userId,
      ipHash,
    })),
  })

  /* Цены пишутся отдельно: у цены голос один и уточняется, тогда как у
     наличия накопление подтверждений и есть суть. */
  /* Марки, которых на заправке не было и которые появились.

     В чат уходит одно сообщение на все сразу: «появились АИ-95 и ДТ»
     читается как новость, а три поста подряд про одну колонку
     читаются как спам. */
  const appearedLabels: string[] = []

  for (const entry of entries) {
    if (entry.price === null) continue

    await prisma.fuelPriceReport.updateMany({
      where: {
        stationId,
        fuel: entry.fuel,
        status: "ACTIVE",
        ...(userId ? { userId } : { userId: null, ipHash }),
      },
      data: { status: "SUPERSEDED" },
    }).catch(() => undefined)

    await prisma.fuelPriceReport.create({
      data: { stationId, latitude, longitude, fuel: entry.fuel, priceRub: entry.price, userId, ipHash },
    }).catch((error) => {
      /* Сбой записи цены не отменяет отметку наличия: наличие важнее, и
         человек уже нажал кнопку. */
      console.error("[fuel-availability] Запись цены:", error)
      return null
    })
  }

  const since = new Date(Date.now() - STALE_WINDOW_MS)
  const reports = await prisma.fuelAvailabilityReport.findMany({
    where: { stationId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { fuel: true, state: true, queue: true, photo: true, comment: true, userId: true, createdAt: true },
  })

  const availability = summarizeAvailability(reports)

  /* Подписчиков будим по каждой марке, что появилась.

     Условие то же, что и раньше: переход «нет или неизвестно» → «есть».
     Иначе отметка на заправке, где топливо и так весь день есть, слала
     бы уведомление всем подписчикам. */
  const stationName = stationNameRaw || "АЗС"
  const city = cityRaw || ""

  for (const entry of entries) {
    if (entry.state !== "YES" || wasAvailable.has(entry.fuel)) continue

    const nowAvailable = availability.some((row) => row.fuel === entry.fuel && row.state === "YES")
    if (!nowAvailable) continue

    void notifyFuelSubscribers({
      stationId,
      stationName,
      city,
      fuel: entry.fuel,
      fuelLabel: AVAILABILITY_FUEL_LABELS[entry.fuel] || entry.fuel,
    })

    appearedLabels.push(AVAILABILITY_FUEL_LABELS[entry.fuel] || entry.fuel)
  }

  /* Сообщение в городской чат — там, где топлива не было и оно
     появилось. Подписчикам уходит личное, чату общее: человек, не
     заводивший подписку, узнаёт о заправке из чата своего города.

     В фоне намеренно: новость встаёт в очередь чата и ждёт своей
     минуты, а водитель, отметивший заправку, должен получить ответ
     сразу — держать его страницу ради поста в чате незачем. */
  if (appearedLabels.length > 0 && city) {
    void broadcastFuelAppeared({
      stationId,
      stationName,
      city,
      fuelLabels: appearedLabels,
      latitude,
      longitude,
    })
  }

  return NextResponse.json({ availability }, { status: 201 })
}
