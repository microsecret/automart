import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { notifyFuelSubscribers } from "@/lib/fuel-subscription-notify"
import {
  AVAILABILITY_FUEL_LABELS,
  STALE_WINDOW_MS,
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

  return NextResponse.json({ stations }, {
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
  const fuel = body?.fuel
  const state = body?.state
  const queue = body?.queue ?? null
  const latitude = Number(body?.latitude)
  const longitude = Number(body?.longitude)

  if (!STATION_ID_PATTERN.test(stationId)) {
    return NextResponse.json({ error: "Некорректная точка на карте" }, { status: 400 })
  }
  if (!isAvailabilityFuel(fuel)) {
    return NextResponse.json({ error: "Выберите вид топлива" }, { status: 400 })
  }
  if (!isAvailabilityState(state)) {
    return NextResponse.json({ error: "Отметьте, есть топливо или нет" }, { status: 400 })
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
  const wasAvailable = summarizeAvailability(beforeRows).some(
    (row) => row.fuel === fuel && row.state === "YES",
  )

  /* Повторная отметка не заменяет прежнюю, а добавляется: у цены голос
     один и уточняется, а у наличия накопление подтверждений и есть суть —
     «есть 92, отметили пятеро» доверия заслуживает больше, чем одна
     отметка.

     От накрутки защищает предел частоты выше: одного человека он
     ограничивает сорока отметками в час на все заправки. */
  await prisma.fuelAvailabilityReport.create({
    data: {
      stationId,
      latitude,
      longitude,
      fuel,
      state,
      queue: state === "YES" ? queue : null,
      photo,
      comment,
      userId,
      ipHash,
    },
  })

  const since = new Date(Date.now() - STALE_WINDOW_MS)
  const reports = await prisma.fuelAvailabilityReport.findMany({
    where: { stationId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { fuel: true, state: true, queue: true, photo: true, comment: true, userId: true, createdAt: true },
  })

  const availability = summarizeAvailability(reports)

  /* Топливо появилось — будим подписчиков. Ответа не ждём: отправка не
     должна задерживать ответ человеку, который только что отметил. */
  if (state === "YES" && !wasAvailable) {
    const nowAvailable = availability.some((row) => row.fuel === fuel && row.state === "YES")
    if (nowAvailable) {
      void notifyFuelSubscribers({
        stationId,
        stationName: typeof body?.stationName === "string" && body.stationName.trim()
          ? body.stationName.trim().slice(0, 120)
          : "АЗС",
        city: typeof body?.city === "string" ? body.city.trim().slice(0, 80) : "",
        fuel,
        fuelLabel: AVAILABILITY_FUEL_LABELS[fuel],
      })
    }
  }

  return NextResponse.json({ availability }, { status: 201 })
}
