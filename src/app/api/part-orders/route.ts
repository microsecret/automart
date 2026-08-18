import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const MAX_QUANTITY = 999

function hashClientIp(ip: string) {
  return createHash("sha256").update(`part-order:${ip}`).digest("hex").slice(0, 32)
}

function readText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : ""
}

/** Оформляет заказ позиции из витрины магазина. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const buyerId = session?.user?.id || null
  const ip = getClientIp(request)

  // Заказ доступен и без регистрации, поэтому анонимный лимит строже:
  // форма отправляет контакты продавцу и не должна становиться каналом спама.
  const limit = rateLimit(`part-order:${buyerId || ip}`, buyerId
    ? { windowMs: 60 * 60 * 1_000, maxRequests: 20 }
    : { windowMs: 60 * 60 * 1_000, maxRequests: 5 })
  if (!limit.success) {
    return NextResponse.json(
      { error: "Слишком много заказов подряд. Попробуйте позже." },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const body = await request.json().catch(() => null)
  const partId = readText(body?.partId, 64)
  const contactName = readText(body?.contactName, 120)
  const contactPhone = readText(body?.contactPhone, 40)
  const contactEmail = readText(body?.contactEmail, 120) || null
  const city = readText(body?.city, 80) || null
  const comment = readText(body?.comment, 1_000) || null
  const quantity = Number(body?.quantity)

  if (!partId) return NextResponse.json({ error: "Позиция не указана" }, { status: 400 })
  if (contactName.length < 2) return NextResponse.json({ error: "Укажите имя" }, { status: 400 })
  // Телефон — единственный надёжный способ связи продавца с покупателем,
  // поэтому проверяется по числу цифр, а не по формату записи.
  if (contactPhone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "Укажите телефон для связи" }, { status: 400 })
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return NextResponse.json({ error: "Количество должно быть от 1 до 999" }, { status: 400 })
  }

  const part = await prisma.part.findUnique({
    where: { id: partId },
    select: {
      id: true, name: true, price: true, oemNumber: true,
      leadTimeDaysMin: true, leadTimeDaysMax: true,
      store: { select: { id: true, status: true } },
    },
  })
  if (!part?.store) return NextResponse.json({ error: "Позиция не найдена" }, { status: 404 })
  // Заказ принимается только у опубликованного магазина: черновик и
  // приостановленная витрина не должны собирать обращения покупателей.
  if (part.store.status !== "ACTIVE") {
    return NextResponse.json({ error: "Магазин временно не принимает заказы" }, { status: 409 })
  }

  const order = await prisma.partOrder.create({
    data: {
      storeId: part.store.id,
      partId: part.id,
      buyerId,
      contactName,
      contactPhone,
      contactEmail,
      city,
      comment,
      quantity,
      // Снимок условий: прайс магазина меняется, а обсуждать надо то, на что
      // покупатель согласился при оформлении.
      itemName: part.name,
      itemPriceRub: part.price,
      itemOemNumber: part.oemNumber,
      leadTimeDaysMin: part.leadTimeDaysMin,
      leadTimeDaysMax: part.leadTimeDaysMax,
      ipHash: hashClientIp(ip),
    },
    select: { id: true, createdAt: true },
  })

  return NextResponse.json({ order }, { status: 201 })
}

/** Возвращает заказы магазина его владельцу. */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  const storeId = request.nextUrl.searchParams.get("storeId")?.trim() || ""
  if (!storeId) return NextResponse.json({ error: "Магазин не указан" }, { status: 400 })

  const store = await prisma.partStore.findFirst({
    where: { id: storeId, ownerId: session.user.id },
    select: { id: true },
  })
  if (!store) return NextResponse.json({ error: "Магазин не найден" }, { status: 404 })

  const orders = await prisma.partOrder.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, contactName: true, contactPhone: true, contactEmail: true, city: true, comment: true,
      quantity: true, itemName: true, itemPriceRub: true, itemOemNumber: true,
      leadTimeDaysMin: true, leadTimeDaysMax: true, status: true, sellerNotes: true, createdAt: true,
    },
  })

  return NextResponse.json({ orders })
}
