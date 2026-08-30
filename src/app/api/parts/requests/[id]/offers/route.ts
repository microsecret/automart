import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { notifyBuyerAboutPartOffer } from "@/lib/part-request-notify"
import { parsePartOffer } from "@/lib/part-request-offer"

export const dynamic = "force-dynamic"

/**
 * Предложение магазина по заявке «ищу деталь».
 *
 * Заявка была дорогой в один конец: форма обещала, что «магазины увидят
 * её и свяжутся в течение дня», человек оставлял телефон и ждал. На
 * деле заявка ложилась в базу и умирала — предложить по ней было
 * нечем: модель для ответа существовала, а способа создать ответ не
 * было ни в API, ни в интерфейсе.
 *
 * Здесь магазин отвечает: цена, состояние, срок и пояснение. Это не
 * заказ и не обязательство — это ответ «есть такая, стоит столько»,
 * после которого стороны договариваются.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  /* Предложение уходит человеку уведомлением: без ограничения частоты
     заявку можно было бы завалить сообщениями с одного аккаунта. */
  const limit = rateLimit(`part-offer:${session.user.id}:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 20 })
  if (!limit.success) {
    return NextResponse.json({ error: "Слишком много предложений подряд. Попробуйте через минуту." }, { status: 429, headers: rateLimitHeaders(limit) })
  }

  /* Отвечают только работающие магазины: заявка с телефоном человека
     не должна быть видна кому попало, и черновой магазин её не видит
     даже в списке.

     Аккаунт может вести до трёх магазинов, поэтому кабинет говорит, от
     чьего имени отвечает: иначе предложение ушло бы от первого
     попавшегося, и покупатель получил бы телефон не того магазина. */
  const body = await request.json().catch(() => null)
  const requestedStoreId = typeof body?.storeId === "string" ? body.storeId : null

  const store = await prisma.partStore.findFirst({
    where: {
      ownerId: session.user.id,
      status: "ACTIVE",
      ...(requestedStoreId ? { id: requestedStoreId } : {}),
    },
    select: { id: true, name: true },
  })
  if (!store) {
    return NextResponse.json({ error: "Отвечать на заявки могут владельцы работающих магазинов" }, { status: 403 })
  }

  const partRequest = await prisma.partRequest.findUnique({
    where: { id },
    select: { id: true, status: true, partName: true, requesterId: true },
  })
  if (!partRequest) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 })

  /* Закрытая заявка ответа не ждёт: человек уже нашёл деталь, и
     предложение по ней только сбивает с толку. */
  if (partRequest.status !== "NEW" && partRequest.status !== "IN_PROGRESS") {
    return NextResponse.json({ error: "Заявка уже закрыта" }, { status: 409 })
  }

  const parsed = parsePartOffer(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const data = parsed.data

  /* Один магазин — одно предложение по заявке: повторное обновляет
     прежнее, а не плодит копии в списке у человека. */
  const existing = await prisma.partRequestOffer.findFirst({
    where: { requestId: partRequest.id, storeId: store.id },
    select: { id: true },
  })

  const offer = existing
    ? await prisma.partRequestOffer.update({
        where: { id: existing.id },
        data,
        select: { id: true, price: true, condition: true, leadTimeDays: true, comment: true, createdAt: true },
      })
    : await prisma.partRequestOffer.create({
        data: { ...data, requestId: partRequest.id, storeId: store.id, sellerId: session.user.id },
        select: { id: true, price: true, condition: true, leadTimeDays: true, comment: true, createdAt: true },
      })

  /* Заявка в работе: по этому признаку она уходит вниз списка у
     остальных магазинов — отвечать на неё уже не так срочно. */
  if (partRequest.status === "NEW") {
    await prisma.partRequest.update({ where: { id: partRequest.id }, data: { status: "IN_PROGRESS" } })
  }

  /* Человек узнаёт о предложении сразу: он оставил заявку и ждёт
     ответа, а не проверяет страницу по расписанию. */
  await notifyBuyerAboutPartOffer({
    requestId: partRequest.id,
    buyerId: partRequest.requesterId,
    partName: partRequest.partName,
    storeName: store.name,
    price: offer.price,
    leadTimeDays: offer.leadTimeDays,
  })

  return NextResponse.json({ offer }, { status: existing ? 200 : 201 })
}
