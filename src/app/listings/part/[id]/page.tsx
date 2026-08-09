import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import PartDetailClient from "./PartDetailClient"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const part = await prisma.part.findUnique({
    where: { id },
    select: { name: true, make: true, model: true },
  })
  if (!part) return { title: "Запчасть не найдена" }
  return {
    title: `${part.name} для ${part.make} ${part.model}`,
    description: `${part.name} — совместимость: ${part.make} ${part.model}. Проверенные запчасти на Авторынке.`,
  }
}

export default async function PartDetailPage({ params }: PageProps) {
  const { id } = await params
  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      compatibility: {
        select: { id: true, make: true, model: true, generation: true, yearFrom: true, yearTo: true, engine: true },
        orderBy: { make: "asc" },
      },
      user: {
        select: {
          id: true, name: true, image: true, createdAt: true,
          parts: { select: { id: true, name: true, price: true }, take: 4 },
        },
      },
      listings: {
        include: {
          reviews: {
            include: { user: { select: { id: true, name: true, image: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      bids: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
    },
  })

  if (!part) notFound()

  const listing = part.listings[0]

  const data = {
    id: part.id,
    name: part.name,
    description: part.description,
    price: part.price,
    condition: part.condition,
    make: part.make,
    model: part.model,
    yearFrom: part.yearFrom,
    yearTo: part.yearTo,
    partType: part.partType,
    subcategory: part.subcategory,
    oemNumber: part.oemNumber,
    suspensionType: part.suspensionType,
    brakeType: part.brakeType,
    compatibility: part.compatibility || [],
    location: part.location,
    images: part.images,
    createdAt: part.createdAt,
    saleFormat: part.saleFormat,
    auctionStatus: part.auctionStatus,
    auctionEndsAt: part.auctionEndsAt,
    auctionCurrentPrice: part.auctionCurrentPrice,
    auctionMinStep: part.auctionMinStep,
    bids: part.bids,
    listingId: listing?.id,
    seller: {
      id: part.user.id,
      name: part.user.name,
      image: part.user.image,
      memberSince: part.user.createdAt,
      otherParts: part.user.parts.filter((p) => p.id !== part.id).slice(0, 4),
    },
    reviews: listing?.reviews || [],
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": part.name,
    "description": part.description || `${part.name} для ${part.make} ${part.model}`,
    "brand": { "@type": "Brand", "name": part.make },
    "category": part.partType,
    "sku": part.oemNumber || undefined,
    "offers": {
      "@type": "Offer",
      "price": part.price,
      "priceCurrency": "RUB",
      "itemCondition": part.condition === "NEW" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PartDetailClient data={data} />
    </>
  )
}
