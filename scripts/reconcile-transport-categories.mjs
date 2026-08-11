import { PrismaClient } from "@prisma/client"
import { pathToFileURL } from "node:url"

const prisma = new PrismaClient()

// Kept in deployable JavaScript deliberately: this runs after `prisma generate`
// and before the Next.js build, without requiring a TypeScript runtime on prod.
const TRANSPORT_CATEGORIES = {
  CAR: { name: "Легковые автомобили", description: "Легковые автомобили и кроссоверы", icon: "Car" },
  MOTORCYCLE: { name: "Мототехника", description: "Мотоциклы, скутеры и квадроциклы", icon: "Motorbike" },
  TRUCK: { name: "Грузовой транспорт", description: "Коммерческий и грузовой транспорт", icon: "Truck" },
  SPECIAL: { name: "Спецтехника", description: "Строительная, дорожная и сельскохозяйственная техника", icon: "Tractor" },
  WATER: { name: "Водный транспорт", description: "Катера, яхты и гидроциклы", icon: "Speedboat" },
  AIR: { name: "Воздушный транспорт", description: "Самолёты, вертолёты и другая авиация", icon: "Plane" },
}

// Older demo imports were generated before the transport verticals existed and
// therefore saved every record with the schema default `CAR`.  These mappings
// intentionally contain only unmistakable manufacturers.  Ambiguous brands
// (for example Honda and Suzuki) are classified by equally unambiguous model
// families below, so a legitimate passenger car is never moved by name alone.
const TYPE_BY_LEGACY_MAKE = {
  AIR: ["Airbus Helicopters", "Bell Helicopter", "Cessna", "Mil", "Robinson Helicopter"],
  WATER: ["Azimut", "Bayliner", "Mercury", "Sea-Doo", "Yamaha Marine"],
  SPECIAL: ["Caterpillar", "Hitachi", "JCB", "Komatsu", "Volvo CE", "XCMG", "МТЗ"],
  TRUCK: ["MAN", "Mercedes-Benz Trucks", "Scania", "Volvo Trucks", "КамАЗ", "МАЗ", "ГАЗ"],
  MOTORCYCLE: ["BMW Motorrad", "Ducati", "Harley-Davidson", "KTM", "Kawasaki", "Yamaha"],
}

const MOTORCYCLE_MODEL_PATTERN = /africa twin|cbr|gold wing|burgman|gsx-|v-strom/i
const ELECTRIC_ONLY_CAR_MAKES = ["Tesla", "Zeekr", "Nio", "Xpeng", "Avatr"]
const DEMO_MEDIA_HOST = "images.unsplash.com"

function withoutDemoMedia(rawImages) {
  if (!rawImages) return null

  try {
    const images = JSON.parse(rawImages)
    if (!Array.isArray(images)) return null

    const trustedImages = images.filter((image) => (
      typeof image === "string"
      && !image.includes(DEMO_MEDIA_HOST)
      && !image.includes("/placeholder")
    ))

    return trustedImages.length ? JSON.stringify(trustedImages) : null
  } catch {
    return null
  }
}

function initialTypeDetails(vehicleType, make, model) {
  const value = `${make} ${model}`.toLowerCase()

  if (vehicleType === "AIR") {
    return { airType: /cessna/.test(value) ? "AIRPLANE" : "HELICOPTER" }
  }
  if (vehicleType === "WATER") {
    return { waterType: /azimut/.test(value) ? "YACHT" : /sea-doo/.test(value) ? "JETSKI" : "BOAT" }
  }
  if (vehicleType === "SPECIAL") {
    return { specialType: /komatsu|hitachi/.test(value) ? "EXCAVATOR" : /jcb|volvo ce/.test(value) ? "LOADER" : "OTHER" }
  }
  if (vehicleType === "TRUCK") {
    return { truckBodyType: /камаз|маз/.test(value) ? "DUMP" : /газ/.test(value) ? "VAN" : "TRACTOR" }
  }
  if (vehicleType === "MOTORCYCLE") {
    return { motorcycleType: /burgman/i.test(value) ? "SCOOTER" : /gsx-|cbr/i.test(value) ? "SPORT" : /africa twin|v-strom/i.test(value) ? "ADVENTURE" : "CRUISER" }
  }
  return null
}

export function inferLegacyVehicleType(make, model) {
  for (const [vehicleType, makes] of Object.entries(TYPE_BY_LEGACY_MAKE)) {
    if (makes.includes(make)) return vehicleType
  }

  if ((make === "Honda" || make === "Suzuki") && MOTORCYCLE_MODEL_PATTERN.test(model)) {
    return "MOTORCYCLE"
  }

  return null
}

function repairLegacyVehicleData(vehicle, vehicleType, categoryId) {
  const existingUsage = Math.max(0, Number(vehicle.mileage) || 0)
  const typeDetails = initialTypeDetails(vehicleType, vehicle.make, vehicle.model)
  const base = {
    vehicleType,
    categoryId,
    bodyType: null,
    driveType: null,
    typeDetails: typeDetails ? JSON.stringify(typeDetails) : null,
  }

  if (vehicleType === "AIR") {
    return {
      ...base,
      mileage: null,
      flightHours: vehicle.flightHours ?? existingUsage,
      operatingHours: null,
      registrationNumber: vehicle.registrationNumber ?? vehicle.vin,
      transmission: "",
      fuelType: vehicle.make === "Cessna" ? "AVGAS" : "JET_A1",
    }
  }

  if (vehicleType === "SPECIAL" || vehicleType === "WATER") {
    return {
      ...base,
      mileage: null,
      operatingHours: vehicle.operatingHours ?? existingUsage,
      flightHours: null,
      ...(vehicleType === "SPECIAL"
        ? { serialNumber: vehicle.serialNumber ?? vehicle.vin }
        : { registrationNumber: vehicle.registrationNumber ?? vehicle.vin }),
      transmission: "",
      fuelType: vehicleType === "SPECIAL" ? "DIESEL" : "GASOLINE",
    }
  }

  if (vehicleType === "TRUCK") {
    return { ...base, transmission: vehicle.transmission === "VARIATOR" ? "MANUAL" : vehicle.transmission || "MANUAL", fuelType: "DIESEL" }
  }

  if (vehicleType === "MOTORCYCLE") {
    return {
      ...base,
      transmission: /burgman/i.test(vehicle.model) ? "VARIATOR" : "MANUAL",
      fuelType: "GASOLINE",
    }
  }

  return base
}

async function main() {
  await prisma.$transaction(async (tx) => {
    const categoryIds = new Map()

    for (const [vehicleType, category] of Object.entries(TRANSPORT_CATEGORIES)) {
      const record = await tx.category.upsert({
        where: { name: category.name },
        update: { description: category.description, icon: category.icon },
        create: category,
        select: { id: true },
      })
      categoryIds.set(vehicleType, record.id)
    }

    for (const [vehicleType, categoryId] of categoryIds) {
      await tx.vehicle.updateMany({ where: { vehicleType }, data: { categoryId } })
    }

    // These segments measure operating or flight time, not road mileage.  A
    // previous schema forced a synthetic zero into mileage; clear it for every
    // already-classified record as well as for newly reclassified legacy data.
    await tx.vehicle.updateMany({
      where: { vehicleType: { in: ["SPECIAL", "WATER", "AIR"] } },
      data: { mileage: null },
    })

    // До разделения транспортных вертикалей авиационные записи получали
    // автомобильный бензин. Исправляем только неавиационные значения,
    // не перезаписывая уже корректно импортированные данные.
    const airFuelNeedsRepair = await tx.vehicle.findMany({
      where: {
        vehicleType: "AIR",
        fuelType: { notIn: ["JET_A1", "AVGAS", "DIESEL"] },
      },
      select: { id: true, make: true },
    })
    for (const vehicle of airFuelNeedsRepair) {
      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: { fuelType: /cessna|piper|beechcraft/i.test(vehicle.make) ? "AVGAS" : "JET_A1" },
      })
    }

    // Earlier demo imports treated every passenger vehicle as combustion
    // powered.  Keep this repair deliberately narrow: these manufacturers
    // are electric-only, unlike brands that legitimately sell hybrid ranges.
    const electricFuelRepair = await tx.vehicle.updateMany({
      where: {
        vehicleType: "CAR",
        make: { in: ELECTRIC_ONLY_CAR_MAKES },
        fuelType: { not: "ELECTRIC" },
      },
      data: { fuelType: "ELECTRIC" },
    })

    // Tesla's own manual covers Model Y from the 2020 model year.  Correct a
    // known pre-launch demo date rather than exposing a non-existent car.
    const modelYYearRepair = await tx.vehicle.updateMany({
      where: { vehicleType: "CAR", make: "Tesla", model: "Model Y", year: { lt: 2020 } },
      data: { year: 2020 },
    })

    // Seed data used a couple of stock Unsplash images for many unrelated
    // listings. They look like real seller photos in a marketplace and damage
    // buyer trust (the same image appeared on cars and motorcycles). The UI
    // has an honest category-specific fallback until the owner uploads media.
    const vehicleDemoMedia = await tx.vehicle.findMany({
      where: { images: { contains: DEMO_MEDIA_HOST } },
      select: { id: true, images: true },
    })
    const partDemoMedia = await tx.part.findMany({
      where: { OR: [{ images: { contains: DEMO_MEDIA_HOST } }, { images: { contains: "/placeholder" } }] },
      select: { id: true, images: true },
    })
    let clearedVehicleMedia = 0
    let clearedPartMedia = 0
    for (const vehicle of vehicleDemoMedia) {
      await tx.vehicle.update({ where: { id: vehicle.id }, data: { images: withoutDemoMedia(vehicle.images) } })
      clearedVehicleMedia += 1
    }
    for (const part of partDemoMedia) {
      await tx.part.update({ where: { id: part.id }, data: { images: withoutDemoMedia(part.images) } })
      clearedPartMedia += 1
    }

    const legacyVehicles = await tx.vehicle.findMany({
      where: { vehicleType: "CAR" },
      select: { id: true, make: true, model: true, mileage: true, operatingHours: true, flightHours: true, vin: true, serialNumber: true, registrationNumber: true, transmission: true },
    })

    let repaired = 0
    for (const vehicle of legacyVehicles) {
      const inferredVehicleType = inferLegacyVehicleType(vehicle.make, vehicle.model)
      if (!inferredVehicleType) continue
      const targetCategoryId = categoryIds.get(inferredVehicleType)
      if (!targetCategoryId) throw new Error(`Missing category for ${inferredVehicleType}`)

      await tx.vehicle.update({
        where: { id: vehicle.id },
        data: repairLegacyVehicleData(vehicle, inferredVehicleType, targetCategoryId),
      })
      repaired += 1
    }

    for (const categoryId of categoryIds.values()) {
      const vehicleCount = await tx.vehicle.count({ where: { categoryId } })
      await tx.category.update({ where: { id: categoryId }, data: { vehicleCount } })
    }

    console.log(
      `Reclassified ${repaired} legacy transport records; repaired ${airFuelNeedsRepair.length} aviation fuel values, ${electricFuelRepair.count} electric fuel values, ${modelYYearRepair.count} Tesla Model Y years; cleared ${clearedVehicleMedia} vehicle and ${clearedPartMedia} part demo media records`,
    )
  })

  console.log("Transport categories reconciled")
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error("Failed to reconcile transport categories", error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
