import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseMarketplaceImages } from "@/lib/media-url"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const MAX_CART_ITEMS = 50

/**
 * Актуальное состояние позиций корзины.
 *
 * Корзина живёт в браузере и помнит цену на момент добавления. Перед
 * оформлением покупатель должен видеть нынешнюю цену и наличие: магазин
 * мог поменять прайс или снять витрину, пока корзина лежала неделю.
 */
export async function POST(request: NextRequest) {
  const limit = rateLimit(`cart-quote:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 60 })
  if (!limit.success) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429, headers: rateLimitHeaders(limit) })

  const body = await request.json().catch(() => null)
  const ids = Array.isArray(body?.partIds)
    ? Array.from(new Set((body.partIds as unknown[]).filter((id): id is string => typeof id === "string" && id.length <= 64))).slice(0, MAX_CART_ITEMS)
    : []
  if (!ids.length) return NextResponse.json({ items: [] })

  const parts = await prisma.part.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, name: true, price: true, images: true, oemNumber: true, brandName: true,
      supplyMode: true, leadTimeDaysMin: true, leadTimeDaysMax: true,
      store: { select: { id: true, name: true, slug: true, city: true, status: true } },
    },
  })
  const byId = new Map(parts.map((part) => [part.id, part]))

  return NextResponse.json({
    items: ids.map((id) => {
      const part = byId.get(id)
      /* Позиция без работающего магазина в корзине остаётся, но
         заказать её нельзя — покупатель должен понять почему. */
      if (!part?.store || part.store.status !== "ACTIVE") return { partId: id, available: false }
      return {
        partId: id,
        available: true,
        name: part.name,
        price: part.price,
        image: parseMarketplaceImages(part.images, 1)?.[0] ?? null,
        oemNumber: part.oemNumber,
        brandName: part.brandName,
        supplyMode: part.supplyMode,
        leadTimeDaysMin: part.leadTimeDaysMin,
        leadTimeDaysMax: part.leadTimeDaysMax,
        store: { id: part.store.id, name: part.store.name, slug: part.store.slug, city: part.store.city },
      }
    }),
  })
}
