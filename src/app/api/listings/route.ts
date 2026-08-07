import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

// GET all listings (with optional filtering)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const skip = (page - 1) * limit

    // Build where clause for filtering
    const where: any = {}

    // Filter by listing type: vehicle or part
    const vehicleId = searchParams.get("vehicleId")
    const partId = searchParams.get("partId")

    if (vehicleId) {
      where.vehicleId = vehicleId
    } else if (partId) {
      where.partId = partId
    } else {
      // If neither specified, show both types (default behavior)
      // We'll handle this in the include/join logic below
    }

    // Vehicle filters
    if (searchParams.get("make")) {
      where.vehicle = {
        ...(where.vehicle ?? {}),
        make: {
          contains: searchParams.get("make") as string,
          mode: 'insensitive'
        }
      }
    }

    if (searchParams.get("model")) {
      where.vehicle = {
        ...(where.vehicle ?? {}),
        model: {
          contains: searchParams.get("model") as string,
          mode: 'insensitive'
        }
      }
    }

    const yearFrom = searchParams.get("yearFrom")
    const yearTo = searchParams.get("yearTo")
    if (yearFrom || yearTo) {
      where.vehicle = {
        ...(where.vehicle ?? {}),
        ...(yearFrom ? { gte: parseInt(yearFrom) } : {}),
        ...(yearTo ? { lte: parseInt(yearTo) } : {})
      }
    }

    const priceFrom = searchParams.get("priceFrom")
    const priceTo = searchParams.get("priceTo")
    if (priceFrom || priceTo) {
      where.vehicle = {
        ...(where.vehicle ?? {}),
        ...(priceFrom ? { gte: parseInt(priceFrom) } : {}),
        ...(priceTo ? { lte: parseInt(priceTo) } : {})
      }
    }

    const mileageFrom = searchParams.get("mileageFrom")
    const mileageTo = searchParams.get("mileageTo")
    if (mileageFrom || mileageTo) {
      where.vehicle = {
        ...(where.vehicle ?? {}),
        ...(mileageFrom ? { gte: parseInt(mileageFrom) } : {}),
        ...(mileageTo ? { lte: parseInt(mileageTo) } : {})
      }
    }

    if (searchParams.get("fuelType")) {
      where.vehicle = {
        ...(where.vehicle ?? {}),
        fuelType: searchParams.get("fuelType") as string
      }
    }

    if (searchParams.get("transmission")) {
      where.vehicle = {
        ...(where.vehicle ?? {}),
        transmission: searchParams.get("transmission") as string
      }
    }

    if (searchParams.get("bodyType")) {
      where.vehicle = {
        ...(where.vehicle ?? {}),
        bodyType: searchParams.get("bodyType") as string
      }
    }

    if (searchParams.get("condition")) {
      where.vehicle = {
        ...(where.vehicle ?? {}),
        condition: searchParams.get("condition") as string
      }
    }

    if (searchParams.get("driveType")) {
      where.vehicle = {
        ...(where.vehicle ?? {}),
        driveType: searchParams.get("driveType") as string
      }
    }

    if (searchParams.get("color")) {
      where.vehicle = {
        ...(where.vehicle ?? {}),
        color: {
          contains: searchParams.get("color") as string,
          mode: 'insensitive'
        }
      }
    }

    if (searchParams.get("location")) {
      where.vehicle = {
        ...(where.vehicle ?? {}),
        location: {
          contains: searchParams.get("location") as string,
          mode: 'insensitive'
        }
      }
    }

    // Part filters
    if (searchParams.get("partName")) {
      where.part = {
        ...(where.part ?? {}),
        name: {
          contains: searchParams.get("partName") as string,
          mode: 'insensitive'
        }
      }
    }

    if (searchParams.get("compatibleMake")) {
      where.part = {
        ...(where.part ?? {}),
        make: {
          contains: searchParams.get("compatibleMake") as string,
          mode: 'insensitive'
        }
      }
    }

    if (searchParams.get("compatibleModel")) {
      where.part = {
        ...(where.part ?? {}),
        model: {
          contains: searchParams.get("compatibleModel") as string,
          mode: 'insensitive'
        }
      }
    }

    const partYearFrom = searchParams.get("partYearFrom")
    const partYearTo = searchParams.get("partYearTo")
    if (partYearFrom || partYearTo) {
      where.part = {
        ...(where.part ?? {}),
        ...(partYearFrom ? { yearFrom: { gte: parseInt(partYearFrom) } } : {}),
        ...(partYearTo ? { yearTo: { lte: parseInt(partYearTo) } } : {})
      }
    }

    if (searchParams.get("partType")) {
      where.part = {
        ...(where.part ?? {}),
        partType: searchParams.get("partType") as string
      }
    }

    // If we have specific vehicle/part filters, we need to handle the join properly
    // Prisma doesn't allow filtering on relations directly in where without include
    // So we need to build the where clause differently for vehicle/part fields

    // Let's rebuild where clause properly for vehicle and part relations
    const vehicleWhere: any = {}
    const partWhere: any = {}
    let hasVehicleFilters = false
    let hasPartFilters = false

    // Vehicle filters
    if (searchParams.get("make")) {
      vehicleWhere.make = {
        contains: searchParams.get("make") as string,
        mode: 'insensitive'
      }
      hasVehicleFilters = true
    }

    if (searchParams.get("model")) {
      vehicleWhere.model = {
        contains: searchParams.get("model") as string,
        mode: 'insensitive'
      }
      hasVehicleFilters = true
    }

    if (yearFrom || yearTo) {
      if (yearFrom) vehicleWhere.year = { ...(vehicleWhere.year ?? {}), gte: parseInt(yearFrom) }
      if (yearTo) vehicleWhere.year = { ...(vehicleWhere.year ?? {}), lte: parseInt(yearTo) }
      hasVehicleFilters = true
    }

    if (priceFrom || priceTo) {
      if (priceFrom) vehicleWhere.price = { ...(vehicleWhere.price ?? {}), gte: parseInt(priceFrom) }
      if (priceTo) vehicleWhere.price = { ...(vehicleWhere.price ?? {}), lte: parseInt(priceTo) }
      hasVehicleFilters = true
    }

    if (mileageFrom || mileageTo) {
      if (mileageFrom) vehicleWhere.mileage = { ...(vehicleWhere.mileage ?? {}), gte: parseInt(mileageFrom) }
      if (mileageTo) vehicleWhere.mileage = { ...(vehicleWhere.mileage ?? {}), lte: parseInt(mileageTo) }
      hasVehicleFilters = true
    }

    if (searchParams.get("fuelType")) {
      vehicleWhere.fuelType = searchParams.get("fuelType") as string
      hasVehicleFilters = true
    }

    if (searchParams.get("transmission")) {
      vehicleWhere.transmission = searchParams.get("transmission") as string
      hasVehicleFilters = true
    }

    if (searchParams.get("bodyType")) {
      vehicleWhere.bodyType = searchParams.get("bodyType") as string
      hasVehicleFilters = true
    }

    if (searchParams.get("condition")) {
      vehicleWhere.condition = searchParams.get("condition") as string
      hasVehicleFilters = true
    }

    if (searchParams.get("driveType")) {
      vehicleWhere.driveType = searchParams.get("driveType") as string
      hasVehicleFilters = true
    }

    if (searchParams.get("color")) {
      vehicleWhere.color = {
        contains: searchParams.get("color") as string,
        mode: 'insensitive'
      }
      hasVehicleFilters = true
    }

    if (searchParams.get("location")) {
      vehicleWhere.location = {
        contains: searchParams.get("location") as string,
        mode: 'insensitive'
      }
      hasVehicleFilters = true
    }

    // Part filters
    if (searchParams.get("partName")) {
      partWhere.name = {
        contains: searchParams.get("partName") as string,
        mode: 'insensitive'
      }
      hasPartFilters = true
    }

    if (searchParams.get("compatibleMake")) {
      partWhere.make = {
        contains: searchParams.get("compatibleMake") as string,
        mode: 'insensitive'
      }
      hasPartFilters = true
    }

    if (searchParams.get("compatibleModel")) {
      partWhere.model = {
        contains: searchParams.get("compatibleModel") as string,
        mode: 'insensitive'
      }
      hasPartFilters = true
    }

    if (partYearFrom || partYearTo) {
      if (partYearFrom) partWhere.yearFrom = { ...(partWhere.yearFrom ?? {}), gte: parseInt(partYearFrom) }
      if (partYearTo) partWhere.yearTo = { ...(partWhere.yearTo ?? {}), lte: parseInt(partYearTo) }
      hasPartFilters = true
    }

    if (searchParams.get("partType")) {
      partWhere.partType = searchParams.get("partType") as string
      hasPartFilters = true
    }

    // Build final where clause
    const finalWhere: any = {}

    // If we have vehicle filters, we need to find listings with vehicles matching those filters
    if (hasVehicleFilters) {
      finalWhere.vehicle = {
        ...(finalWhere.vehicle ?? {}),
        ...(Object.keys(vehicleWhere).length > 0 ? vehicleWhere : {})
      }
    }

    // If we have part filters, we need to find listings with parts matching those filters
    if (hasPartFilters) {
      finalWhere.part = {
        ...(finalWhere.part ?? {}),
        ...(Object.keys(partWhere).length > 0 ? partWhere : {})
      }
    }

    // If we specified vehicleId or partId directly, add those
    if (vehicleId) {
      finalWhere.vehicleId = vehicleId
    }
    if (partId) {
      finalWhere.partId = partId
    }

    // If both vehicleId and partId are unspecified, we want both types
    // This is the default behavior, so we don't need to add anything special

    const [listings, total] = await prisma.$transaction([
      prisma.listing.findMany({
        where: finalWhere,
        skip,
        take: limit,
        include: {
          vehicle: true,
          part: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true
            }
          }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.listing.count({
        where: finalWhere
      })
    ])

    return NextResponse.json({
      listings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching listings:", error)
    return NextResponse.json(
      { error: "Failed to fetch listings" },
      { status: 500 }
    )
  }
}

// POST create a new listing
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
    const { title, description, price, vehicleId, partId, isFeatured } = body

    // Application-level validation: exactly one of vehicleId or partId must be provided
    if ((vehicleId && partId) || (!vehicleId && !partId)) {
      return NextResponse.json(
        {
          error: "Invalid listing: Must specify either a vehicle or a part, but not both"
        },
        { status: 400 }
      )
    }

    // Additional validation
    if (!title || title.trim() === "") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      )
    }

    if (price === undefined || price === null || price < 0) {
      return NextResponse.json(
        { error: "Valid price is required" },
        { status: 400 }
      )
    }

    // Check if vehicle exists (if vehicleId provided)
    if (vehicleId) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: { id: true }
      })
      if (!vehicle) {
        return NextResponse.json(
          { error: "Vehicle not found" },
          { status: 404 }
        )
      }

      // Verify vehicle belongs to current user
      if (vehicle.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Unauthorized to create listing for this vehicle" },
          { status: 403 }
        )
      }
    }

    // Check if part exists (if partId provided)
    if (partId) {
      const part = await prisma.part.findUnique({
        where: { id: partId },
        select: { id: true }
      })
      if (!part) {
        return NextResponse.json(
          { error: "Part not found" },
          { status: 404 }
        )
      }

      // Verify part belongs to current user
      if (part.userId !== session.user.id) {
        return NextResponse.json(
          { error: "Unauthorized to create listing for this part" },
          { status: 403 }
        )
      }
    }

    // Create the listing
    const listing = await prisma.listing.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        price: parseInt(price),
        isFeatured: !!isFeatured,
        userId: session.user.id,
        vehicleId: vehicleId || null,
        partId: partId || null
      },
      include: {
        vehicle: true,
        part: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true
          }
        }
      }
    })

    return NextResponse.json(listing, { status: 201 })
  } catch (error) {
    console.error("Error creating listing:", error)
    return NextResponse.json(
      { error: "Failed to create listing" },
      { status: 500 }
    )
  }
}