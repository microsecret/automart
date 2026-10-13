import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { parseMarketplaceImages } from "@/lib/media-url"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { COMPLEMENTS } from "@/lib/cart-complements"
import { matchKnownMake } from "@/lib/listing-make"

export const dynamic = "force-dynamic"

const LIMIT = 8
const ACTIVE_STORE = { store: { status: "ACTIVE" } } as const

const SELECT = {
  id: true, name: true, price: true, images: true, brandName: true, oemNumber: true, productGroup: true,
  supplyMode: true, leadTimeDaysMin: true, leadTimeDaysMax: true, make: true, model: true, storeId: true,
  store: { select: { name: true, city: true } },
} as const

type Row = {
  id: string; name: string; price: number; images: string | null; brandName: string | null; oemNumber: string | null
  productGroup: string | null; supplyMode: string; leadTimeDaysMin: number | null; leadTimeDaysMax: number | null
  make: string; model: string; storeId: string | null; store: { name: string; city: string | null } | null
}

const toCard = (part: Row, reason: string | null) => ({
  id: part.id, name: part.name, price: part.price, image: parseMarketplaceImages(part.images, 1)?.[0] ?? null,
  brandName: part.brandName, oemNumber: part.oemNumber, supplyMode: part.supplyMode,
  leadTimeDaysMin: part.leadTimeDaysMin, leadTimeDaysMax: part.leadTimeDaysMax,
  storeName: part.store?.name ?? null, reason,
})

/**
 * Окно «Товар добавлен в корзину»: сама позиция и что взять вместе с ней.
 *
 * Порядок подборки:
 * 1) настоящие совместные заказы (позиции из одного оформления корзины) —
 *    только они дают заголовок «С этим товаром покупают»;
 * 2) правила по товарным группам (к маслу — фильтр), сначала у того же
 *    магазина — одна доставка, — затем подходящие к той же машине.
 * Выдумывать «покупают вместе» без данных нельзя.
 */
export async function GET(request: NextRequest) {
  const limit = rateLimit(`cart-suggest:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 60 })
  if (!limit.success) return NextResponse.json({ error: "Слишком много запросов" }, { status: 429, headers: rateLimitHeaders(limit) })

  const partId = (request.nextUrl.searchParams.get("partId") || "").slice(0, 64)
  const exclude = new Set((request.nextUrl.searchParams.get("exclude") || "").split(",").filter(Boolean).slice(0, 60))
  if (!partId) return NextResponse.json({ error: "Позиция не указана" }, { status: 400 })

  const part = await prisma.part.findFirst({ where: { id: partId, ...ACTIVE_STORE }, select: SELECT })
  if (!part) return NextResponse.json({ item: null, suggestions: [], basis: "none" })
  exclude.add(part.id)

  /* 1. Совместные покупки: другие позиции из тех же оформлений. */
  const checkouts = await prisma.partOrder.findMany({
    where: { partId: part.id, checkoutId: { not: null } },
    select: { checkoutId: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  })
  const checkoutIds = checkouts.map((row) => row.checkoutId as string)
  const together = checkoutIds.length
    ? await prisma.partOrder.groupBy({
        by: ["partId"],
        where: { checkoutId: { in: checkoutIds }, partId: { not: null, notIn: [...exclude] } },
        _count: { _all: true },
        orderBy: { _count: { partId: "desc" } },
        take: LIMIT,
      })
    : []
  const togetherParts = together.length
    ? await prisma.part.findMany({ where: { id: { in: together.map((row) => row.partId as string) }, ...ACTIVE_STORE }, select: SELECT })
    : []
  const cards = togetherParts.map((row) => toCard(row, null))
  togetherParts.forEach((row) => exclude.add(row.id))

  /* 2. Правила по группам. */
  const rules = part.productGroup ? COMPLEMENTS[part.productGroup] ?? [] : []
  if (cards.length < LIMIT && rules.length) {
    const candidates = await prisma.part.findMany({
      where: { productGroup: { in: rules.map((rule) => rule.group) }, id: { notIn: [...exclude] }, ...ACTIVE_STORE },
      select: SELECT,
      orderBy: { updatedAt: "desc" },
      take: 120,
    })
    const brand = matchKnownMake(part.make)
    const fits = (row: Row) => brand && matchKnownMake(row.make) === brand && row.model.toLowerCase() === part.model.toLowerCase()
    const universal = (row: Row) => row.make === "Универсальная" || row.make === "Universal"
    const score = (row: Row) => (row.storeId === part.storeId ? 4 : 0) + (fits(row) ? 3 : universal(row) ? 1 : 0)
      + (rules.length - rules.findIndex((rule) => rule.group === row.productGroup)) * 0.1
    /* Чужая машина в подборке — ошибка, а не подсказка: деталь под другую
       модель отсекается, универсальная остаётся. */
    const ranked = candidates
      .filter((row) => fits(row) || universal(row) || !brand)
      .sort((a, b) => score(b) - score(a) || a.price - b.price)
    const perGroup = new Map<string, number>()
    for (const row of ranked) {
      if (cards.length >= LIMIT) break
      const used = perGroup.get(row.productGroup as string) ?? 0
      if (used >= 3) continue
      perGroup.set(row.productGroup as string, used + 1)
      cards.push(toCard(row, rules.find((rule) => rule.group === row.productGroup)?.reason ?? null))
    }
  }

  return NextResponse.json({
    item: { ...toCard(part, null), storeCity: part.store?.city ?? null },
    suggestions: cards,
    basis: togetherParts.length ? "together" : cards.length ? "rules" : "none",
  })
}
