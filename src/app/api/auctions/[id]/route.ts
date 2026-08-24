import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit } from "@/lib/rate-limit"
import { buildPublicAuctionPolicy } from "@/lib/auction-public-catalog"
import { auctionVehicleIdentity } from "@/lib/auction-normalization"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const publicPolicy = buildPublicAuctionPolicy()
    /* Поля перечислены поимённо.

       Раньше карточка отдавала все сорок семь колонок, включая наценку
       площадки — на боевом лоте 150 000 ₽. Покупатель видел, сколько
       зарабатывает площадка.

       Закупочная цена и ссылка на источник остаются: они показываются в
       разбивке калькулятора и в разметке для поисковиков — там это
       честность перед покупателем, а не утечка. Уходят только наценка,
       курс пересчёта и служебные поля модерации. */
    const listing = await prisma.auctionListing.findFirst({
      where: {
        id,
        ...publicPolicy.where,
      },
      select: {
        id: true, make: true, model: true, year: true, mileage: true,
        finalPrice: true, priceRub: true, sourcePrice: true, sourceCurrency: true,
        country: true, source: true, sourceId: true, sourceUrl: true, lotNumber: true,
        imageUrl: true, images: true, bodyType: true, fuelType: true, color: true,
        driveType: true, transmission: true, power: true, engineVolume: true,
        manufacturedMonth: true, location: true, vin: true, viewCount: true,
        equipment: true, conditionInfo: true, specsRu: true, descriptionRu: true,
        auctionDate: true, createdAt: true, updatedAt: true,
      },
    })
    if (!listing) return NextResponse.json({ error: "Лот недоступен" }, { status: 404 })

    const viewCookieName = `auction-view-${listing.id}`
    const alreadyCounted = request.cookies.get(viewCookieName)?.value === "1"
    const uniqueView = rateLimit(`auction-view:${listing.id}:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 1 })
    /* Счётчик увеличивается, но в ответ идёт суженный объект.

       `update` возвращает все колонки — через него наценка и служебные
       поля вернулись бы в ответ, минуя выборку выше. Число просмотров
       поправляем на месте: отдельный запрос за ним не нужен. */
    let viewedListing = listing
    if (!alreadyCounted && uniqueView.success) {
      const updated = await prisma.auctionListing
        .update({
          where: { id },
          data: { viewCount: { increment: 1 } },
          select: { viewCount: true },
        })
        .catch(() => null)
      if (updated) viewedListing = { ...listing, viewCount: updated.viewCount }
    }

    const identity = auctionVehicleIdentity(listing.make, listing.model)
    /* Поля перечислены поимённо, а число кандидатов сокращено.

       Раньше выбирались шестьдесят полных лотов ради четырёх похожих —
       со всеми сорока семью колонками, включая наценку площадки и ссылку
       на первоисточник. Отбор идёт по марке, году и цене, а показывается
       двенадцать полей: остальное уходило впустую и утекало наружу.

       Тридцати кандидатов достаточно: они отсортированы по свежести, и
       среди них заведомо найдётся четыре близких по марке и году. */
    const candidates = await prisma.auctionListing.findMany({
      where: {
        ...publicPolicy.where,
        id: { not: listing.id },
        country: listing.country,
      },
      select: {
        id: true, make: true, model: true, year: true, mileage: true,
        finalPrice: true, bodyType: true, fuelType: true, engineVolume: true,
        imageUrl: true, images: true, source: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 30,
    })
    const similar = candidates
      .map((candidate) => {
        const candidateIdentity = auctionVehicleIdentity(candidate.make, candidate.model)
        const makePenalty = candidateIdentity.make.toLocaleLowerCase("ru-RU") === identity.make.toLocaleLowerCase("ru-RU") ? 0 : 8
        const yearPenalty = Math.abs(candidate.year - listing.year)
        const pricePenalty = listing.finalPrice > 0
          ? Math.min(4, Math.abs(candidate.finalPrice - listing.finalPrice) / listing.finalPrice * 4)
          : 0
        return { candidate, score: makePenalty + yearPenalty + pricePenalty }
      })
      .sort((left, right) => left.score - right.score)
      .slice(0, 4)
      .map(({ candidate }) => candidate)

    const response = NextResponse.json({ listing: viewedListing, similar })
    if (!alreadyCounted) response.cookies.set(viewCookieName, "1", { httpOnly: true, sameSite: "lax", maxAge: 60 * 60, path: "/" })
    return response
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
