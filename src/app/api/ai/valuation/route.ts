import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

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
    const { vehicleId } = body

    if (!vehicleId) {
      return NextResponse.json(
        { error: "Vehicle ID is required" },
        { status: 400 }
      )
    }

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

    // Check if vehicle belongs to current user (for privacy)
    // In a real marketplace, valuation might be available for any vehicle
    // but for now we'll restrict to user's own vehicles
    if (vehicle.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to valuate this vehicle" },
        { status: 403 }
      )
    }

    // Mock AI valuation logic
    // In a real implementation, this would call an AI service like OpenAI or a custom model
    const basePrice = vehicle.price || 0
    const ageFactor = Math.max(0.5, 1 - (new Date().getFullYear() - vehicle.year) * 0.02)
    const mileageFactor = vehicle.mileage
      ? Math.max(0.3, 1 - (vehicle.mileage / 100000) * 0.4)
      : 1

    // Random factor to simulate AI variability (±15%)
    const randomFactor = 0.85 + Math.random() * 0.3

    const estimatedValue = Math.round(basePrice * ageFactor * mileageFactor * randomFactor)
    const confidenceScore = 0.75 + Math.random() * 0.2 // 75-95% confidence

    // Create AI service log
    const aiLog = await prisma.aIServiceLog.create({
      data: {
        serviceType: "VALUATION",
        inputData: JSON.stringify({ vehicleId, vehicle }),
        resultData: JSON.stringify({
          estimatedValue,
          confidenceScore,
          factors: {
            ageFactor,
            mileageFactor,
            randomFactor
          },
          timestamp: new Date().toISOString()
        }),
        userId: session.user.id
      }
    })

    return NextResponse.json({
      estimatedValue,
      confidenceScore,
      factors: {
        ageFactor,
        mileageFactor,
        randomFactor
      },
      aiLogId: aiLog.id
    })
  } catch (error) {
    console.error("Error in valuation AI service:", error)
    return NextResponse.json(
      { error: "Failed to process valuation request" },
      { status: 500 }
    )
  }
}