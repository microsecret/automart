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
    const { vehicleId, monthsAhead = 12 } = body

    if (!vehicleId) {
      return NextResponse.json(
        { error: "Vehicle ID is required" },
        { status: 400 }
      )
    }

    // Validate monthsAhead
    const months = parseInt(monthsAhead)
    if (isNaN(months) || months < 1 || months > 36) {
      return NextResponse.json(
        { error: "Months ahead must be between 1 and 36" },
        { status: 400 }
      )
    }

    // Get vehicle details
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId }
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
        { error: "Unauthorized to predict price for this vehicle" },
        { status: 403 }
      )
    }

    // Mock AI price prediction logic
    const currentPrice = vehicle.price || 0
    const age = new Date().getFullYear() - vehicle.year
    const monthlyDepreciationRate = 0.005 + (age * 0.0002) // Increase depreciation with age

    // Factors that affect future price
    const marketTrendFactor = 0.95 + Math.random() * 0.1 // Market can go up or down slightly
    const seasonalFactor = 1 + (Math.sin(Date.now() / (1000 * 60 * 60 * 24 * 30)) * 0.05) // Seasonal variation

    // Calculate predicted price
    let predictedPrice = currentPrice
    for (let i = 0; i < months; i++) {
      predictedPrice *= (1 - monthlyDepreciationRate)
    }
    predictedPrice *= marketTrendFactor * seasonalFactor
    predictedPrice = Math.max(predictedPrice, currentPrice * 0.2) // Never go below 20% of original value

    predictedPrice = Math.round(predictedPrice)

    // Confidence decreases with time horizon
    const baseConfidence = 0.9
    const confidenceDecay = 0.005 * months // 0.5% loss of confidence per month
    const confidenceScore = Math.max(0.5, baseConfidence - confidenceDecay)

    // Create AI service log
    const aiLog = await prisma.aIServiceLog.create({
      data: {
        serviceType: "PRICE_PREDICTION",
        inputData: JSON.stringify({ vehicleId, monthsAhead: months, vehicle }),
        resultData: JSON.stringify({
          predictedPrice,
          confidenceScore,
          predictionDetails: {
            currentPrice,
            monthlyDepreciationRate,
            monthsAhead: months,
            marketTrendFactor,
            seasonalFactor
          },
          timestamp: new Date().toISOString()
        }),
        userId: session.user.id
      }
    })

    return NextResponse.json({
      predictedPrice,
      confidenceScore,
      monthsAhead: months,
      aiLogId: aiLog.id
    })
  } catch (error) {
    console.error("Error in price prediction AI service:", error)
    return NextResponse.json(
      { error: "Failed to process price prediction request" },
      { status: 500 }
    )
  }
}