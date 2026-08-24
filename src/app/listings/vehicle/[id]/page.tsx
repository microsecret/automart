import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getServerSession } from "next-auth"
import { prisma } from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { isListingModerator, LISTING_STATUS, publicListingWhere } from "@/lib/listing-lifecycle"
import VehicleDetailClient from "./VehicleDetailClient"
import { findLabel, BODY_TYPES, DRIVE_TYPES, CONDITIONS, STEERING_WHEELS, DOCUMENT_STATUSES, DAMAGE_INFO, SELLER_TYPES, AVAILABILITY_TYPES, getFuelOptions, getTransmissionOptions, getUsageMeta, supportsTransmission } from "@/lib/constants"
import { cityInPrepositional } from "@/lib/geo"
import { parseImages } from "@/lib/format"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const listing = await prisma.listing.findFirst({
    where: { vehicleId: id, ...publicListingWhere },
    select: { vehicle: { select: { make: true, model: true, year: true, price: true, images: true, location: true, mileage: true } } },
  })
  const vehicle = listing?.vehicle
  if (!vehicle) return { title: "Объявление не найдено", robots: { index: false, follow: false } }
  // Люди ищут «купить <марка> <модель> <год> в <городе>», а не «<год> <марка>
  // <модель>»: заголовок собирается под живой запрос, а не под запись в базе.
  const model = `${vehicle.make} ${vehicle.model}`
  const price = vehicle.price.toLocaleString("ru-RU")
  const cityIn = cityInPrepositional(vehicle.location)
  const title = `Купить ${model} ${vehicle.year} в ${cityIn} — ${price} ₽`
  const mileage = vehicle.mileage ? `, пробег ${vehicle.mileage.toLocaleString("ru-RU")} км` : ""
  const description = `${model} ${vehicle.year} года${mileage} с рук в ${cityIn}. Цена ${price} ₽, фотографии, характеристики и контакты продавца. Проверка истории и безопасная сделка на LeWheel.`
  const canonical = `/listings/vehicle/${id}`
  const images = parseImages(vehicle.images)
  const socialTitle = `${model} ${vehicle.year} — ${price} ₽`
  return {
    title,
    description,
    // Ключевые слова повторяют формулировки поисковых запросов по этой марке.
    keywords: [
      `купить ${model}`,
      `${model} ${vehicle.year}`,
      `${model} бу`,
      `${model} ${vehicle.location}`,
      `${vehicle.make} с пробегом`,
      "купить авто с пробегом",
      "продажа автомобилей",
    ],
    alternates: { canonical },
    openGraph: { type: "website", title: socialTitle, description, url: canonical, images: images.length ? [{ url: images[0], alt: socialTitle }] : undefined },
    twitter: { card: "summary_large_image", title: socialTitle, description, images: images.length ? [images[0]] : undefined },
  }
}

export default async function VehicleDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await getServerSession(authOptions)
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
            where: { listings: { some: publicListingWhere } },
            select: { id: true, make: true, model: true, year: true, price: true },
            take: 4,
          },
        },
      },
      listings: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: {
          reviews: {
            include: { user: { select: { id: true, name: true, image: true } } },
            orderBy: { createdAt: "desc" },
          },
          /* Последнее изменение цены.

             Движение цены говорит покупателю больше, чем сама цена:
             снижение — знак готовности торговаться, и человек решается
             написать. Берём одно последнее событие: цепочка изменений
             интересна разве что аналитику. */
          priceEvents: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { oldPrice: true, newPrice: true, createdAt: true },
          },
        },
      },
    },
  })

  if (!vehicle) notFound()

  // Находим листинг для этого ТС
  const listing = vehicle.listings[0]
  const canPreview = Boolean(
    listing && (
      listing.status === LISTING_STATUS.ACTIVE ||
      listing.userId === session?.user?.id ||
      isListingModerator(session?.user?.role)
    ),
  )
  if (!listing || !canPreview) notFound()

  // Похожие объявления
  const similar = await prisma.vehicle.findMany({
    where: {
      id: { not: vehicle.id },
      make: vehicle.make,
      price: { gte: vehicle.price * 0.7, lte: vehicle.price * 1.3 },
      listings: { some: publicListingWhere },
    },
    take: 4,
    include: { listings: { where: publicListingWhere, take: 1 } },
    orderBy: { createdAt: "desc" },
  })

  // Преобразуем для клиента
  /* Снижение цены — сильный довод написать продавцу.

     Показываем только падение и только за последний месяц: рост цены
     покупателя отталкивает, а полугодовая давность уже ничего не значит. */
  const lastPriceEvent = listing?.priceEvents?.[0]
  const priceDrop = lastPriceEvent && lastPriceEvent.newPrice < lastPriceEvent.oldPrice
    && Date.now() - new Date(lastPriceEvent.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000
    ? { amount: lastPriceEvent.oldPrice - lastPriceEvent.newPrice, at: lastPriceEvent.createdAt.toISOString() }
    : null

  const data = {
    id: vehicle.id,
    priceDrop,
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
    serialNumber: vehicle.serialNumber,
    registrationNumber: vehicle.registrationNumber,
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
    similar: similar.map((v) => {
      const similarUsageMeta = getUsageMeta(v.vehicleType)
      const similarUsage = similarUsageMeta.field === "flightHours" ? v.flightHours
        : similarUsageMeta.field === "operatingHours" ? v.operatingHours
        : v.mileage
      const similarImage = parseImages(v.images).find((image) => !image.includes("/placeholder/")) || null

      return {
        id: v.id,
        title: `${v.year} ${v.make} ${v.model}`,
        price: v.price,
        year: v.year,
        image: similarImage,
        usageLabel: similarUsage == null
          ? null
          : `${similarUsage.toLocaleString("ru-RU")} ${similarUsageMeta.unit}`,
        transmissionLabel: supportsTransmission(v.vehicleType) && v.transmission && v.transmission !== "OTHER"
          ? findLabel(getTransmissionOptions(v.vehicleType), v.transmission)
          : null,
        fuelTypeLabel: v.fuelType && v.fuelType !== "OTHER"
          ? findLabel(getFuelOptions(v.vehicleType), v.fuelType)
          : null,
        engineVolume: v.engineVolume,
        location: v.location,
        vehicleType: v.vehicleType,
        bodyType: v.bodyType,
        listingId: v.listings[0]?.id,
      }
    }),
  }

  const usageMeta = getUsageMeta(vehicle.vehicleType)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    "name": `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    "brand": { "@type": "Brand", "name": vehicle.make },
    "model": vehicle.model,
    "vehicleModelDate": String(vehicle.year),
    ...(usageMeta.field === "mileage" && vehicle.mileage != null ? { "mileageFromOdometer": { "@type": "QuantitativeValue", "value": vehicle.mileage, "unitCode": "KMT" } } : {}),
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <VehicleDetailClient data={data} />
    </>
  )
}
