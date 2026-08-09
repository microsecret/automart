import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
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
    const { vehicleId, imageUrl } = body

    if (!vehicleId) {
      return NextResponse.json(
        { error: "Vehicle ID is required" },
        { status: 400 }
      )
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image URL is required for damage assessment" },
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
        { error: "Unauthorized to assess damage for this vehicle" },
        { status: 403 }
      )
    }

    // Mock AI damage assessment logic
    // In a real implementation, this would analyze the image using computer vision
    const damageSeverity = Math.floor(Math.random() * 4) // 0-3 scale
    const damageLocations = []
    const possibleLocations = ['front', 'rear', 'left side', 'right side', 'hood', 'roof', 'trunk']

    // Randomly select 0-3 damage locations
    const numLocations = Math.floor(Math.random() * 4)
    for (let i = 0; i < numLocations; i++) {
      const randomIndex = Math.floor(Math.random() * possibleLocations.length)
      damageLocations.push(possibleLocations[randomIndex])
    }

    // Remove duplicates
    const uniqueDamageLocations = [...new Set(damageLocations)]

    const repairCostEstimate = damageSeverity * 500 + Math.random() * 1000 // $0-2500 estimate
    const needsRepair = damageSeverity > 0

    // Create AI service log
    const aiLog = await prisma.aIServiceLog.create({
      data: {
        serviceType: "DAMAGE_ASSESSMENT",
        inputData: JSON.stringify({ vehicleId, imageUrl }),
        resultData: JSON.stringify({
          damageSeverity,
          damageLocations: uniqueDamageLocations,
          repairCostEstimate: Math.round(repairCostEstimate),
          needsRepair,
          assessmentDetails: {
            severityLevel: damageSeverity === 0 ? "none" :
                         damageSeverity === 1 ? "minor" :
                         damageSeverity === 2 ? "moderate" : "severe",
            affectedAreas: uniqueDamageLocations.length,
            assessmentConfidence: 0.7 + Math.random() * 0.2 // 70-90% confidence
          },
          timestamp: new Date().toISOString()
        }),
        userId: session.user.id
      }
    })

    return NextResponse.json({
      damageSeverity,
      damageLocations: uniqueDamageLocations,
      repairCostEstimate: Math.round(repairCostEstimate),
      needsRepair,
      aiLogId: aiLog.id
    })
  } catch (error) {
    console.error("Error in damage assessment AI service:", error)
    return NextResponse.json(
      { error: "Failed to process damage assessment request" },
      { status: 500 }
    )
  }
}
