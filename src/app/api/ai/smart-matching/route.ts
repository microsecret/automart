import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../../auth/[...nextauth]/route"
import { prisma } from "@/lib/prisma"
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
    const { vehicleId, limit = 5 } = body

    if (!vehicleId) {
      return NextResponse.json(
        { error: "Vehicle ID is required" },
        { status: 400 }
      )
    }

    // Validate limit
    const queryLimit = Math.min(Math.max(parseInt(limit) || 5, 1), 20) // Between 1 and 20

    // Get vehicle details
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        category: true
      }
    })

    if (!vehicle) {
      return NextResponse.json(
        { error: "Vehicle not found" },
        { status: 404 }
      )
    }

    // Check authorization
    if (vehicle.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to get smart matches for this vehicle" },
        { status: 403 }
      )
    }

    // Mock AI smart matching logic
    // In a real implementation, this would use embedding models or similarity search
    const similarVehicles = await prisma.vehicle.findMany({
      where: {
        AND: [
          { id: { not: vehicleId } }, // Exclude the vehicle itself
          { userId: session.user.id }, // Only show user's own vehicles for privacy
          {
            OR: [
              { make: vehicle.make },
              { model: vehicle.model },
              { categoryId: vehicle.categoryId },
              { year: {
                gte: vehicle.year - 2,
                lte: vehicle.year + 2
              } }
            ]
          }
        ]
      },
      include: {
        category: true,
        _count: {
          select: { listings: true }
        }
      },
      orderBy: [
        { make: vehicle.make ? 'asc' : undefined },
        { model: vehicle.model ? 'asc' : undefined },
        { year: 'desc' }
      ],
      take: queryLimit
    })

    // Calculate match scores (mock)
    const matchesWithScores = similarVehicles.map(similarVehicle => {
      let score = 0
      const maxScore = 100

      // Make match (30 points)
      if (similarVehicle.make === vehicle.make) score += 30

      // Model match (25 points)
      if (similarVehicle.model === vehicle.model) score += 25

      // Category match (20 points)
      if (similarVehicle.categoryId === vehicle.categoryId) score += 20

      // Year proximity (15 points)
      const yearDiff = Math.abs(similarVehicle.year - vehicle.year)
      const yearScore = Math.max(0, 15 - (yearDiff * 2)) // Lose 2 points per year difference
      score += yearScore

      // Price proximity (10 points)
      if (similarVehicle.price && vehicle.price) {
        const priceDiff = Math.abs(similarVehicle.price - vehicle.price)
        const maxPrice = Math.max(similarVehicle.price, vehicle.price)
        const priceScore = Math.max(0, 10 - (priceDiff / maxPrice) * 10)
        score += priceScore
      }

      return {
        vehicle: similarVehicle,
        matchScore: Math.min(Math.round(score), maxScore)
      }
    })

    // Sort by match score descending
    matchesWithScores.sort((a, b) => b.matchScore - a.matchScore)

    // Create AI service log
    const aiLog = await prisma.aIServiceLog.create({
      data: {
        serviceType: "SMART_MATCHING",
        inputData: JSON.stringify({ vehicleId, limit: queryLimit, vehicle }),
        resultData: JSON.stringify({
          matchesCount: matchesWithScores.length,
          matches: matchesWithScores.map(match => ({
            vehicleId: match.vehicle.id,
            matchScore: match.matchScore
          })),
          criteriaUsed: {
            makeMatch: true,
            modelMatch: true,
            categoryMatch: true,
            yearProximity: true,
            priceProximity: true
          },
          timestamp: new Date().toISOString()
        }),
        userId: session.user.id
      }
    })

    return NextResponse.json({
      matches: matchesWithScores,
      aiLogId: aiLog.id
    })
  } catch (error) {
    console.error("Error in smart matching AI service:", error)
    return NextResponse.json(
      { error: "Failed to process smart matching request" },
      { status: 500 }
    )
  }
}