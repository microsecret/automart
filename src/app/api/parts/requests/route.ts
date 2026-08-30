import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { normalizePartRequest, requestClarity, validatePartRequest } from "@/lib/part-request"

export const dynamic = "force-dynamic"

/**
 * Заявка «ищу деталь».
 *
 * Вход не требуется: в разделе запчастей пока нет позиций, и человек,
 * пришедший за деталью, ещё не имеет причин заводить аккаунт. Требовать
 * регистрацию до первого полезного действия значит потерять заявку.
 * Телефон обязателен — без него магазину некуда ответить.
 */

const payloadSchema = z.object({
  partName: z.string().trim().max(200).optional().nullable(),
  oemNumber: z.string().trim().max(64).optional().nullable(),
  make: z.string().trim().max(64).optional().nullable(),
  model: z.string().trim().max(64).optional().nullable(),
  year: z.union([z.number(), z.string()]).optional().nullable(),
  vin: z.string().trim().max(32).optional().nullable(),
  condition: z.string().trim().max(16).optional().nullable(),
  comment: z.string().trim().max(2_000).optional().nullable(),
  name: z.string().trim().min(2, "Как к вам обращаться?").max(120),
  phone: z.string().trim().min(6, "Телефон нужен, чтобы вам ответили").max(32),
  email: z.string().trim().email("Проверьте адрес почты").max(160).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().nullable(),
  contactMethod: z.string().trim().max(16).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  /* Ограничение по человеку, а если он не вошёл — по адресу. Пять заявок
     за четверть часа: больше подряд отправляет не покупатель. */
  const limit = rateLimit(`part-request:${session?.user?.id || getClientIp(request)}`, {
    windowMs: 15 * 60_000,
    maxRequests: 5,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: "Слишком много заявок подряд. Попробуйте через несколько минут." },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = payloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Проверьте заполнение", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  /* Проверка содержания отдельно от проверки формы: правило «нужно либо
     название, либо номер» описывает смысл заявки, а не тип поля. */
  const issues = validatePartRequest(parsed.data)
  if (issues.length) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of issues) {
      fieldErrors[issue.field] = [...(fieldErrors[issue.field] || []), issue.message]
    }
    return NextResponse.json({ error: issues[0].message, details: fieldErrors }, { status: 422 })
  }

  const normalized = normalizePartRequest(parsed.data)

  const created = await prisma.partRequest.create({
    data: {
      ...normalized,
      /* Считаем при записи: сортировать по готовому числу в кабинете
         магазина дешевле, чем пересчитывать на каждой выдаче. */
      clarity: requestClarity(parsed.data),
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      city: parsed.data.city || null,
      requesterId: session?.user?.id || null,
    },
    select: { id: true, createdAt: true },
  })

  return NextResponse.json({ id: created.id, success: true }, { status: 201, headers: rateLimitHeaders(limit) })
}

/**
 * Список заявок — для кабинета магазина.
 *
 * Открыт только продавцам: заявки содержат телефоны, и показывать их
 * всем подряд нельзя.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  const ownStores = await prisma.partStore.findMany({
    where: { ownerId: session.user.id, status: "ACTIVE" },
    select: { id: true },
  })
  if (ownStores.length === 0) {
    return NextResponse.json({ error: "Заявки видны владельцам магазинов запчастей" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const take = Math.min(Number(searchParams.get("limit")) || 30, 100)
  const status = searchParams.get("status")

  const requests = await prisma.partRequest.findMany({
    where: status ? { status } : { status: { in: ["NEW", "IN_PROGRESS"] } },
    /* Понятные заявки вперёд: заявка с номером детали обрабатывается за
       минуту, «фильтр на японку» требует переписки. Вперемешку хорошие
       заявки хоронятся под плохими. */
    orderBy: [{ clarity: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true, partName: true, oemNumber: true, make: true, model: true,
      year: true, condition: true, comment: true, city: true, clarity: true,
      status: true, createdAt: true,
      _count: { select: { offers: true } },
      /* Свой ответ на заявке. Магазин видел только общее число
         предложений и не понимал, отвечал ли он сам: жал «Ответить»
         второй раз вслепую, заново вспоминая цену, которую уже называл. */
      offers: {
        where: { storeId: { in: ownStores.map((store) => store.id) } },
        select: { id: true, price: true, leadTimeDays: true, createdAt: true },
        take: 1,
      },
    },
  })

  return NextResponse.json({ requests })
}
