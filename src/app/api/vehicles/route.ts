import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import axios from "axios"
import { prisma } from "@/lib/prisma"
import { BODY_TYPES, DRIVE_TYPES, getFuelOptions, getTransmissionOptions, supportsTransmission } from "@/lib/constants"
import { isVehicleCategoryCompatible } from "@/lib/vehicleCategories"
import { getVehicleSubtypeConfig, inferVehicleSubtype, isValidVehicleSubtype, type VehicleTypeDetails } from "@/lib/vehicleSubtypes"

const TYPE_DETAIL_KEYS: Record<string, Set<string>> = {
  MOTORCYCLE: new Set(["motorcycleType", "finalDrive", "strokeCycle"]),
  TRUCK: new Set(["truckBodyType", "axleFormula", "ecoClass", "payloadKg", "grossWeightKg", "transmissionVariant"]),
  SPECIAL: new Set(["specialType", "operatingWeightKg", "bucketVolumeM3", "diggingDepthM", "payloadKg"]),
  WATER: new Set(["waterType", "hullMaterial", "hullLengthM", "waterEngineType"]),
  AIR: new Set(["airType", "airEngineType", "engineCount", "mtowKg", "passengerCapacity"]),
  CAR: new Set(),
}

function normalizeOptionalNonNegativeInteger(value: unknown) {
  if (value === undefined || value === null || value === "") return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}

function normalizeTypeDetails(value: unknown, vehicleType: string) {
  const raw = typeof value === "string" ? (() => {
    try { return JSON.parse(value) } catch { return null }
  })() : value
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {} as VehicleTypeDetails

  const allowed = TYPE_DETAIL_KEYS[vehicleType] || new Set<string>()
  const details = Object.fromEntries(Object.entries(raw).filter(([key, item]) =>
    allowed.has(key) && (typeof item === "string" || typeof item === "number" || typeof item === "boolean"),
  )) as VehicleTypeDetails
  return details
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      make,
      model,
      year,
      price,
      mileage,
      operatingHours,
      flightHours,
      vin,
      fuelType,
      transmission,
      bodyType,
      color,
      doors,
      engineVolume,
      power,
      driveType,
      condition,
      steeringWheel,
      ownersCount,
      documentsStatus,
      damageInfo,
      sellerType,
      availability,
      customsCleared,
      generation,
      keywords,
      vehicleType,
      typeDetails,
      location,
      description,
      images,
      categoryId
    } = body

    // Validation
    if (!make || !make.trim()) {
      return NextResponse.json(
        { error: "Make is required" },
        { status: 400 }
      )
    }

    if (!model || !model.trim()) {
      return NextResponse.json(
        { error: "Model is required" },
        { status: 400 }
      )
    }

    const normalizedYear = Number(year)
    const maxVehicleYear = new Date().getFullYear() + 1
    if (!Number.isInteger(normalizedYear) || normalizedYear < 1886 || normalizedYear > maxVehicleYear) {
      return NextResponse.json(
        { error: `Год выпуска должен быть целым числом от 1886 до ${maxVehicleYear}` },
        { status: 400 }
      )
    }

    if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
      return NextResponse.json(
        { error: "Valid price is required" },
        { status: 400 }
      )
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: "Category is required" },
        { status: 400 }
      )
    }

    const allowedVehicleTypes = new Set(["CAR", "MOTORCYCLE", "TRUCK", "SPECIAL", "WATER", "AIR"])
    const normalizedVehicleType = allowedVehicleTypes.has(String(vehicleType)) ? String(vehicleType) : "CAR"
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    })
    if (!category) {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 404 })
    }
    if (!isVehicleCategoryCompatible(category.name, normalizedVehicleType)) {
      return NextResponse.json({ error: "Категория не соответствует типу транспорта" }, { status: 400 })
    }

    // Geocode location if provided
    let lat = null
    let lng = null
    if (location && location.trim()) {
      try {
        const geocodeResponse = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
          params: {
            address: location.trim(),
            key: process.env.GOOGLE_MAPS_API_KEY
          }
        })

        if (geocodeResponse.data.status === "OK" && geocodeResponse.data.results.length > 0) {
          const { lat: latitude, lng: longitude } = geocodeResponse.data.results[0].geometry.location
          lat = latitude
          lng = longitude
        }
      } catch (geocodeError) {
        console.error("Geocoding error:", geocodeError)
        // Continue without lat/lng if geocoding fails
      }
    }

    // Create the vehicle
    const inferredSubtype = inferVehicleSubtype(normalizedVehicleType, make.trim(), model.trim())
    const submittedTypeDetails = normalizeTypeDetails(typeDetails, normalizedVehicleType)
    const subtypeConfig = getVehicleSubtypeConfig(normalizedVehicleType)
    const submittedSubtype = subtypeConfig && normalizedVehicleType !== "CAR"
      ? submittedTypeDetails[subtypeConfig.field]
      : null
    if (typeof submittedSubtype === "string" && !isValidVehicleSubtype(normalizedVehicleType, submittedSubtype)) {
      return NextResponse.json({ error: "Выбранный подтип не подходит для этой категории транспорта" }, { status: 400 })
    }
    const normalizedTypeDetails = Object.keys({ ...inferredSubtype.typeDetails, ...submittedTypeDetails }).length > 0
      ? JSON.stringify({ ...inferredSubtype.typeDetails, ...submittedTypeDetails })
      : null
    const normalizedMileage = normalizeOptionalNonNegativeInteger(mileage)
    const normalizedOperatingHours = normalizeOptionalNonNegativeInteger(operatingHours)
    const normalizedFlightHours = normalizeOptionalNonNegativeInteger(flightHours)

    if (normalizedMileage === undefined || normalizedOperatingHours === undefined || normalizedFlightHours === undefined) {
      return NextResponse.json({ error: "Пробег и наработка должны быть неотрицательными целыми числами" }, { status: 400 })
    }

    const allowedFuelTypes = new Set<string>(getFuelOptions(normalizedVehicleType).map((item) => item.value))
    if (!fuelType || !allowedFuelTypes.has(String(fuelType))) {
      return NextResponse.json({ error: "Выбранный тип топлива не подходит для этой категории транспорта" }, { status: 400 })
    }

    const transmissionOptions = getTransmissionOptions(normalizedVehicleType)
    if (supportsTransmission(normalizedVehicleType) && (!transmission || !transmissionOptions.some((item) => item.value === transmission))) {
      return NextResponse.json({ error: "Выбранный тип КПП не подходит для этой категории транспорта" }, { status: 400 })
    }

    const allowedDriveTypes = new Set<string>(DRIVE_TYPES.map((item) => item.value))
    if (normalizedVehicleType === "CAR" && driveType && !allowedDriveTypes.has(String(driveType))) {
      return NextResponse.json({ error: "Выбранный тип привода не подходит для легкового автомобиля" }, { status: 400 })
    }
    const allowedBodyTypes = new Set<string>(BODY_TYPES.map((item) => item.value))
    if (normalizedVehicleType === "CAR" && bodyType && !allowedBodyTypes.has(String(bodyType))) {
      return NextResponse.json({ error: "Выбранный тип кузова не подходит для легкового автомобиля" }, { status: 400 })
    }
    const normalizedBodyType = normalizedVehicleType === "CAR"
      ? String(bodyType || inferredSubtype.bodyType || "").trim() || null
      : null

    const vehicle = await prisma.vehicle.create({
      data: {
        make: make.trim(),
        model: model.trim(),
        year: normalizedYear,
        price: parseInt(price),
        mileage: ["SPECIAL", "WATER", "AIR"].includes(normalizedVehicleType) ? 0 : (normalizedMileage || 0),
        operatingHours: ["SPECIAL", "WATER"].includes(normalizedVehicleType) ? normalizedOperatingHours : null,
        flightHours: normalizedVehicleType === "AIR" ? normalizedFlightHours : null,
        vin: vin ? vin.trim() : null,
        fuelType: fuelType ? fuelType.trim() : null,
        transmission: supportsTransmission(normalizedVehicleType) ? String(transmission).trim() : "NOT_APPLICABLE",
        bodyType: normalizedBodyType,
        color: color ? color.trim() : null,
        doors: doors ? parseInt(doors) : null,
        engineVolume: engineVolume ? parseFloat(engineVolume) : null,
        power: power ? parseInt(power) : null,
        driveType: normalizedVehicleType === "CAR" && driveType ? driveType.trim() : null,
        condition: condition ? condition.trim() : null,
        steeringWheel: steeringWheel ? steeringWheel.trim() : null,
        ownersCount: ownersCount ? parseInt(ownersCount) : null,
        documentsStatus: documentsStatus ? documentsStatus.trim() : null,
        damageInfo: damageInfo ? damageInfo.trim() : null,
        sellerType: sellerType ? sellerType.trim() : null,
        availability: availability ? availability.trim() : null,
        customsCleared: customsCleared !== undefined ? Boolean(customsCleared) : null,
        generation: generation ? generation.trim() : null,
        keywords: keywords ? keywords.trim() : null,
        vehicleType: normalizedVehicleType,
        typeDetails: normalizedTypeDetails,
        location: location ? location.trim() : null,
        description: description ? description.trim() : null,
        images: images || null, // Expecting JSON string of array or null
        userId: session.user.id,
        categoryId,
        lat,
        lng
      }
    })

    return NextResponse.json(vehicle, { status: 201 })
  } catch (error) {
    console.error("Error creating vehicle:", error)
    return NextResponse.json(
      { error: "Failed to create vehicle" },
      { status: 500 }
    )
  }
}
