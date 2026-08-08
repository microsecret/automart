import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import PartDetailClient from "./PartDetailClient"

export const dynamic = "force-dynamic"

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps) {
  const part = await prisma.part.findUnique({
    where: { id: params.id },
    select: { name: true, make: true, model: true },
  })
  if (!part) return { title: "Запчасть не найдена" }
  return {
    title: `${part.name} для ${part.make} ${part.model}`,
    description: `${part.name} — совместимость: ${part.make} ${part.model}. Проверенные запчасти на Авторынке.`,
  }
}

export default async function PartDetailPage({ params }: PageProps) {
  const part = await prisma.part.findUnique({
    where: { id: params.id },
    include: {
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
    location: part.location,
    images: part.images,
    createdAt: part.createdAt,
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

  return <PartDetailClient data={data} />
}
