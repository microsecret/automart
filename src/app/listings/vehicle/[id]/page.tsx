import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import VehicleDetailClient from "./VehicleDetailClient"
import { findLabel, BODY_TYPES, FUEL_TYPES, TRANSMISSIONS, DRIVE_TYPES, CONDITIONS } from "@/lib/constants"

export const dynamic = "force-dynamic"

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
    select: { make: true, model: true, year: true, price: true },
  })
  if (!vehicle) return { title: "Объявление не найдено" }
  return {
    title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    description: `${vehicle.make} ${vehicle.model} ${vehicle.year} года — характеристики, фото, цена. Проверенные объявления на Авторынке.`,
  }
}

export default async function VehicleDetailPage({ params }: PageProps) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          email: true,
          createdAt: true,
          vehicles: {
            select: { id: true, make: true, model: true, year: true, price: true },
            take: 4,
          },
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

  if (!vehicle) notFound()

  // Находим листинг для этого ТС
  const listing = vehicle.listings[0]

  // Похожие объявления
  const similar = await prisma.vehicle.findMany({
    where: {
      id: { not: vehicle.id },
      make: vehicle.make,
      price: { gte: vehicle.price * 0.7, lte: vehicle.price * 1.3 },
    },
    take: 4,
    include: { listings: true },
    orderBy: { createdAt: "desc" },
  })

  // Преобразуем для клиента
  const data = {
    id: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    price: vehicle.price,
    mileage: vehicle.mileage,
    vin: vehicle.vin,
    fuelType: vehicle.fuelType,
    fuelTypeLabel: findLabel(FUEL_TYPES, vehicle.fuelType),
    transmission: vehicle.transmission,
    transmissionLabel: findLabel(TRANSMISSIONS, vehicle.transmission),
    bodyType: vehicle.bodyType,
    bodyTypeLabel: vehicle.bodyType ? findLabel(BODY_TYPES, vehicle.bodyType) : null,
    color: vehicle.color,
    doors: vehicle.doors,
    engineVolume: vehicle.engineVolume,
    power: vehicle.power,
    driveType: vehicle.driveType,
    driveTypeLabel: vehicle.driveType ? findLabel(DRIVE_TYPES, vehicle.driveType) : null,
    condition: vehicle.condition,
    conditionLabel: findLabel(CONDITIONS, vehicle.condition),
    location: vehicle.location,
    lat: vehicle.lat,
    lng: vehicle.lng,
    description: vehicle.description,
    images: vehicle.images,
    createdAt: vehicle.createdAt,
    listingId: listing?.id,
    seller: {
      id: vehicle.user.id,
      name: vehicle.user.name,
      image: vehicle.user.image,
      memberSince: vehicle.user.createdAt,
      otherVehicles: vehicle.user.vehicles.filter((v) => v.id !== vehicle.id),
    },
    reviews: listing?.reviews || [],
    similar: similar.map((v) => ({
      id: v.id,
      title: `${v.year} ${v.make} ${v.model}`,
      price: v.price,
      year: v.year,
      listingId: v.listings[0]?.id,
    })),
  }

  return <VehicleDetailClient data={data} />
}
