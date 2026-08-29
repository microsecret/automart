import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAvailabilityFuel } from "@/lib/fuel-availability"
import { MAX_SUBSCRIPTIONS_PER_USER, isSubscriptionKind } from "@/lib/fuel-subscription"

export const dynamic = "force-dynamic"

const STATION_ID_PATTERN = /^[a-z]+-[a-z]+-\d+$/i

/** Список подписок человека. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ subscriptions: [] })

  const subscriptions = await prisma.fuelSubscription.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      stationId: true,
      stationName: true,
      fuel: true,
      city: true,
      lastNotifiedAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ subscriptions })
}

/** Заводит подписку. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  /* Подписка невозможна без учётной записи: уведомление уходит в бот, а
     его адрес известен только вошедшему. */
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Войдите, чтобы подписаться" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const kind = body?.kind
  const stationId = typeof body?.stationId === "string" ? body.stationId.trim() : null
  const stationName = typeof body?.stationName === "string" ? body.stationName.trim().slice(0, 120) : null
  const fuel = body?.fuel ?? null
  const city = typeof body?.city === "string" ? body.city.trim().slice(0, 80) : null

  if (!isSubscriptionKind(kind)) {
    return NextResponse.json({ error: "Некорректный вид подписки" }, { status: 400 })
  }

  /* Каждому виду нужны свои поля: подписка на марку без марки или на
     точку без точки молча не сработала бы никогда. */
  if (kind === "STATION" || kind === "STATION_FUEL") {
    if (!stationId || !STATION_ID_PATTERN.test(stationId)) {
      return NextResponse.json({ error: "Некорректная точка на карте" }, { status: 400 })
    }
  }
  if (kind === "STATION_FUEL" || kind === "CITY_FUEL") {
    if (!isAvailabilityFuel(fuel)) {
      return NextResponse.json({ error: "Выберите вид топлива" }, { status: 400 })
    }
  }
  if (kind === "CITY_FUEL" && !city) {
    return NextResponse.json({ error: "Не указан город" }, { status: 400 })
  }

  /* Та же подписка второй раз — не ошибка: человек мог нажать дважды или
     забыть, что уже подписан. Возвращаем существующую. */
  const existing = await prisma.fuelSubscription.findFirst({
    where: {
      userId: session.user.id,
      kind,
      stationId: kind === "CITY_FUEL" ? null : stationId,
      fuel: kind === "STATION" ? null : fuel,
      city: kind === "CITY_FUEL" ? city : null,
    },
    select: { id: true },
  })
  if (existing) return NextResponse.json({ subscription: existing, existed: true })

  const count = await prisma.fuelSubscription.count({ where: { userId: session.user.id } })
  if (count >= MAX_SUBSCRIPTIONS_PER_USER) {
    return NextResponse.json(
      { error: `Больше ${MAX_SUBSCRIPTIONS_PER_USER} подписок держать нельзя — уведомления перестанут читаться. Отпишитесь от лишних.` },
      { status: 409 },
    )
  }

  const subscription = await prisma.fuelSubscription.create({
    data: {
      userId: session.user.id,
      kind,
      stationId: kind === "CITY_FUEL" ? null : stationId,
      stationName: kind === "CITY_FUEL" ? null : stationName,
      fuel: kind === "STATION" ? null : fuel,
      city: kind === "CITY_FUEL" ? city : null,
    },
    select: { id: true },
  })

  return NextResponse.json({ subscription }, { status: 201 })
}

/** Снимает подписку. */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Нет прав" }, { status: 401 })

  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Не указана подписка" }, { status: 400 })

  /* Условие по владельцу обязательно: без него любой вошедший снимал бы
     чужие подписки, зная идентификатор. */
  const removed = await prisma.fuelSubscription.deleteMany({
    where: { id, userId: session.user.id },
  })

  if (removed.count === 0) return NextResponse.json({ error: "Подписка не найдена" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
