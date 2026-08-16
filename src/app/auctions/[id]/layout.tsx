import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { buildPublicAuctionPolicy } from "@/lib/auction-public-catalog"
import { auctionSourceLabel } from "@/lib/auction-sources"
import { isSafeMediaUrl, parseAuctionImages } from "@/lib/media-url"

type LayoutProps = {
  children: React.ReactNode
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { id } = await params
  const policy = buildPublicAuctionPolicy()
  const listing = await prisma.auctionListing.findFirst({
    where: { id, ...policy.where },
    select: {
      make: true,
      model: true,
      year: true,
      mileage: true,
      priceRub: true,
      finalPrice: true,
      conditionInfo: true,
      source: true,
      imageUrl: true,
      images: true,
    },
  })

  if (!listing) {
    return { title: "Лот недоступен", robots: { index: false, follow: false } }
  }

  const title = `${listing.make} ${listing.model} ${listing.year} — ${auctionSourceLabel(listing.source)}`
  const mileage = listing.mileage === null ? "пробег не опубликован" : `${listing.mileage.toLocaleString("ru-RU")} км`
  const isRentalTransfer = (() => {
    if (!listing.conditionInfo) return false
    try {
      const parsed = JSON.parse(listing.conditionInfo) as { verifiedItems?: unknown }
      return Array.isArray(parsed.verifiedItems) && parsed.verifiedItems.some((item) => {
        if (!item || typeof item !== "object") return false
        const record = item as { label?: unknown; status?: unknown }
        return record.label === "Тип предложения" && typeof record.status === "string" && /аренд/i.test(record.status)
      })
    } catch {
      return false
    }
  })()
  const description = isRentalTransfer
    ? `${title}, ${mileage}. Расчётный остаток регулярных платежей ${listing.priceRub.toLocaleString("ru-RU")} ₽ — не цена продажи автомобиля; условия выкупа и экспорта требуют подтверждения.`
    : `${title}, ${mileage}. Предварительная стоимость под ключ ${listing.finalPrice.toLocaleString("ru-RU")} ₽, фотографии и расчёт доставки в Россию.`
  const canonical = `/auctions/${id}`
  const image = isSafeMediaUrl(listing.imageUrl) ? listing.imageUrl : parseAuctionImages(listing.images)?.[0]

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", title, description, url: canonical, images: image ? [{ url: image, alt: title }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  }
}

export default function AuctionDetailLayout({ children }: LayoutProps) {
  return children
}
