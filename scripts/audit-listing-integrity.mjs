import { PrismaClient } from "@prisma/client"
import { inferLegacyVehicleType } from "./reconcile-transport-categories.mjs"

const prisma = new PrismaClient()
const REQUIRED_TRIGGERS = [
  "Listing_require_exactly_one_subject_insert",
  "Listing_require_exactly_one_subject_update",
  "Vehicle_delete_linked_listing",
  "Part_delete_linked_listing",
]
const REQUIRED_INDEXES = [
  "Listing_live_vehicle_subject_key",
  "Listing_live_part_subject_key",
  "Vehicle_serialNumber_idx",
  "Vehicle_registrationNumber_idx",
]
const CATEGORY_NAME_BY_VEHICLE_TYPE = {
  CAR: "Легковые автомобили",
  MOTORCYCLE: "Мототехника",
  TRUCK: "Грузовой транспорт",
  SPECIAL: "Спецтехника",
  WATER: "Водный транспорт",
  AIR: "Воздушный транспорт",
}

function inspectMedia(value) {
  if (!value) return { state: "empty" }

  try {
    const images = JSON.parse(value)
    if (!Array.isArray(images) || images.length > 12) return { state: "invalid" }
    const hasUnsafeUrl = images.some((image) => {
      if (typeof image !== "string") return true
      if (image.startsWith("/uploads/")) return image.includes("\\") || image.includes("..")
      try {
        const url = new URL(image)
        return url.protocol !== "https:" || Boolean(url.username || url.password)
      } catch {
        return true
      }
    })
    return hasUnsafeUrl ? { state: "invalid" } : { state: "safe" }
  } catch {
    return { state: "invalid" }
  }
}

function hasValidVehicleIdentity(vehicle) {
  const hasVin = typeof vehicle.vin === "string" && /^[A-HJ-NPR-Z0-9]{17}$/.test(vehicle.vin)
  const hasSerialNumber = typeof vehicle.serialNumber === "string" && vehicle.serialNumber.trim().length >= 3
  const hasRegistrationNumber = typeof vehicle.registrationNumber === "string" && vehicle.registrationNumber.trim().length >= 3

  if (["CAR", "MOTORCYCLE", "TRUCK"].includes(vehicle.vehicleType)) return hasVin
  if (vehicle.vehicleType === "SPECIAL") return hasVin || hasSerialNumber
  return hasVin || hasRegistrationNumber
}

async function main() {
  const [orphanedListings, ambiguousListings, vehicleCount, partCount, listingCount, userCount, auctionCount, newsCount, triggers, indexes, duplicateLiveSubjects, vehicles, parts] = await Promise.all([
    prisma.listing.findMany({
      where: { vehicleId: null, partId: null },
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.listing.findMany({
      where: { vehicleId: { not: null }, partId: { not: null } },
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.vehicle.count(),
    prisma.part.count(),
    prisma.listing.count(),
    prisma.user.count(),
    prisma.auctionListing.count(),
    prisma.news.count(),
    prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type = 'trigger'"),
    prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type = 'index'"),
    prisma.$queryRawUnsafe(`
      SELECT 'vehicle' AS kind, vehicleId AS subjectId, COUNT(*) AS total
      FROM "Listing"
      WHERE "vehicleId" IS NOT NULL AND "deletedAt" IS NULL AND "status" <> 'ARCHIVED'
      GROUP BY "vehicleId"
      HAVING COUNT(*) > 1
      UNION ALL
      SELECT 'part' AS kind, partId AS subjectId, COUNT(*) AS total
      FROM "Listing"
      WHERE "partId" IS NOT NULL AND "deletedAt" IS NULL AND "status" <> 'ARCHIVED'
      GROUP BY "partId"
      HAVING COUNT(*) > 1
    `),
    prisma.vehicle.findMany({
      select: {
        id: true,
        make: true,
        model: true,
        vehicleType: true,
        mileage: true,
        vin: true,
        serialNumber: true,
        registrationNumber: true,
        images: true,
        category: { select: { name: true } },
      },
    }),
    prisma.part.findMany({
      select: { id: true, images: true },
    }),
  ])

  const installedTriggers = triggers.map((trigger) => trigger.name).filter((name) => typeof name === "string")
  const missingTriggers = REQUIRED_TRIGGERS.filter((name) => !installedTriggers.includes(name))
  const installedIndexes = indexes.map((index) => index.name).filter((name) => typeof name === "string")
  const missingIndexes = REQUIRED_INDEXES.filter((name) => !installedIndexes.includes(name))
  const categoryMismatches = vehicles.filter((vehicle) => {
    const expectedName = CATEGORY_NAME_BY_VEHICLE_TYPE[vehicle.vehicleType]
    return expectedName && vehicle.category?.name !== expectedName
  })
  const legacyTypeMismatches = vehicles.filter((vehicle) => {
    const inferredVehicleType = inferLegacyVehicleType(vehicle.make, vehicle.model)
    return inferredVehicleType !== null && inferredVehicleType !== vehicle.vehicleType
  })
  const identityMismatches = vehicles.filter((vehicle) => !hasValidVehicleIdentity(vehicle))
  const nonRoadMileageMismatches = vehicles.filter((vehicle) =>
    ["SPECIAL", "WATER", "AIR"].includes(vehicle.vehicleType) && vehicle.mileage !== null,
  )
  const media = [...vehicles, ...parts].map((record) => inspectMedia(record.images))
  const mediaSummary = {
    safe: media.filter((record) => record.state === "safe").length,
    empty: media.filter((record) => record.state === "empty").length,
    invalid: media.filter((record) => record.state === "invalid").length,
  }

  const report = {
    checkedAt: new Date().toISOString(),
    totals: {
      users: userCount,
      listings: listingCount,
      vehicles: vehicleCount,
      parts: partCount,
      auctionLots: auctionCount,
      news: newsCount,
    },
    integrity: {
      orphanedListings: orphanedListings.length,
      ambiguousListings: ambiguousListings.length,
      duplicateLiveSubjects: duplicateLiveSubjects.length,
      valid: orphanedListings.length === 0 && ambiguousListings.length === 0 && duplicateLiveSubjects.length === 0 && missingTriggers.length === 0 && missingIndexes.length === 0 && categoryMismatches.length === 0 && legacyTypeMismatches.length === 0 && identityMismatches.length === 0 && nonRoadMileageMismatches.length === 0,
    },
    databaseTriggers: {
      installed: REQUIRED_TRIGGERS.filter((name) => installedTriggers.includes(name)),
      missing: missingTriggers,
    },
    databaseIndexes: {
      installed: REQUIRED_INDEXES.filter((name) => installedIndexes.includes(name)),
      missing: missingIndexes,
    },
    categoryIntegrity: {
      mismatches: categoryMismatches.length,
      samples: categoryMismatches.slice(0, 20).map((vehicle) => ({
        id: vehicle.id,
        vehicleType: vehicle.vehicleType,
        category: vehicle.category?.name || null,
        expectedCategory: CATEGORY_NAME_BY_VEHICLE_TYPE[vehicle.vehicleType] || null,
      })),
    },
    transportTypeIntegrity: {
      legacyMismatches: legacyTypeMismatches.length,
      samples: legacyTypeMismatches.slice(0, 20).map((vehicle) => ({
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        vehicleType: vehicle.vehicleType,
        expectedVehicleType: inferLegacyVehicleType(vehicle.make, vehicle.model),
      })),
    },
    vehicleIdentityIntegrity: {
      mismatches: identityMismatches.length,
      samples: identityMismatches.slice(0, 20).map((vehicle) => ({
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        vehicleType: vehicle.vehicleType,
        vin: vehicle.vin,
        serialNumber: vehicle.serialNumber,
        registrationNumber: vehicle.registrationNumber,
      })),
    },
    usageIntegrity: {
      nonRoadMileageMismatches: nonRoadMileageMismatches.length,
      samples: nonRoadMileageMismatches.slice(0, 20).map((vehicle) => ({
        id: vehicle.id,
        vehicleType: vehicle.vehicleType,
        mileage: vehicle.mileage,
      })),
    },
    media: mediaSummary,
    samples: {
      orphanedListings,
      ambiguousListings,
      duplicateLiveSubjects,
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main()
  .catch((error) => {
    console.error("Failed to audit listing integrity", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
