import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import VehicleDetailClient from "./VehicleDetailClient"
import { findLabel, BODY_TYPES, DRIVE_TYPES, CONDITIONS, STEERING_WHEELS, DOCUMENT_STATUSES, DAMAGE_INFO, SELLER_TYPES, AVAILABILITY_TYPES, getFuelOptions, getTransmissionOptions, getUsageMeta, supportsTransmission } from "@/lib/constants"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: { make: true, model: true, year: true, price: true },
  })
  if (!vehicle) return { title: "Объявление не найдено" }
  return {
    title: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    description: `${vehicle.make} ${vehicle.model} ${vehicle.year} года — характеристики, фото, цена. Проверенные объявления на Авторынке.`,
  }
}

export default async function VehicleDetailPage({ params }: PageProps) {
  const { id } = await params
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
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
    vehicleType: vehicle.vehicleType,
    typeDetails: vehicle.typeDetails,
    mileage: vehicle.mileage,
    operatingHours: vehicle.operatingHours,
    flightHours: vehicle.flightHours,
    vin: vehicle.vin,
    fuelType: vehicle.fuelType,
    fuelTypeLabel: findLabel(getFuelOptions(vehicle.vehicleType), vehicle.fuelType),
    transmission: vehicle.transmission,
    transmissionLabel: supportsTransmission(vehicle.vehicleType) ? findLabel(getTransmissionOptions(vehicle.vehicleType), vehicle.transmission) : null,
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
    steeringWheel: vehicle.steeringWheel,
    steeringWheelLabel: vehicle.steeringWheel ? findLabel(STEERING_WHEELS, vehicle.steeringWheel) : null,
    ownersCount: vehicle.ownersCount,
    documentsStatus: vehicle.documentsStatus,
    documentsStatusLabel: vehicle.documentsStatus ? findLabel(DOCUMENT_STATUSES, vehicle.documentsStatus) : null,
    damageInfo: vehicle.damageInfo,
    damageInfoLabel: vehicle.damageInfo ? findLabel(DAMAGE_INFO, vehicle.damageInfo) : null,
    sellerType: vehicle.sellerType,
    sellerTypeLabel: vehicle.sellerType ? findLabel(SELLER_TYPES, vehicle.sellerType) : null,
    availability: vehicle.availability,
    availabilityLabel: vehicle.availability ? findLabel(AVAILABILITY_TYPES, vehicle.availability) : null,
    customsCleared: vehicle.customsCleared,
    generation: vehicle.generation,
    keywords: vehicle.keywords,
    location: vehicle.location,
    lat: vehicle.lat,
    lng: vehicle.lng,
    description: vehicle.description,
    images: vehicle.images,
    createdAt: vehicle.createdAt,
    listingId: listing?.id,
    views: listing?.views || 0,
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

  const usageMeta = getUsageMeta(vehicle.vehicleType)
  const usageValue = usageMeta.field === "flightHours" ? vehicle.flightHours
    : usageMeta.field === "operatingHours" ? vehicle.operatingHours
    : vehicle.mileage
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    "name": `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    "brand": { "@type": "Brand", "name": vehicle.make },
    "model": vehicle.model,
    "vehicleModelDate": String(vehicle.year),
    ...(usageMeta.field === "mileage" ? { "mileageFromOdometer": { "@type": "QuantitativeValue", "value": vehicle.mileage, "unitCode": "KMT" } } : {}),
    ...(vehicle.fuelType ? { "fuelType": vehicle.fuelType } : {}),
    ...(supportsTransmission(vehicle.vehicleType) ? { "vehicleTransmission": vehicle.transmission } : {}),
    "vehicleConfiguration": vehicle.bodyType || undefined,
    "color": vehicle.color || undefined,
    "vehicleEngine": vehicle.engineVolume ? { "@type": "EngineSpecification", "engineDisplacement": { "@type": "QuantitativeValue", "value": vehicle.engineVolume * 1000, "unitCode": "CMQ" } } : undefined,
    "offers": {
      "@type": "Offer",
      "price": vehicle.price,
      "priceCurrency": "RUB",
      "itemCondition": `https://schema.org/${vehicle.condition === "NEW" ? "NewCondition" : "UsedCondition"}`,
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <VehicleDetailClient data={data} />
    </>
  )
}
