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
    const { vehicleId } = body

    if (!vehicleId) {
      return NextResponse.json(
        { error: "Vehicle ID is required" },
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

    // Check authorization (similar to valuation)
    if (vehicle.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized to check history for this vehicle" },
        { status: 403 }
      )
    }

    // Mock AI history check logic
    // In a real implementation, this would check vehicle history databases
    const hasAccidents = Math.random() > 0.7 // 30% chance of accident history
    const hasTitleIssues = Math.random() > 0.9 // 10% chance of title issues
    const hasServiceRecords = Math.random() > 0.4 // 60% chance of service records
    const previousOwners = Math.floor(Math.random() * 4) + 1 // 1-4 previous owners

    const overallScore = Math.round(
      (hasAccidents ? 30 : 100) *
      (hasTitleIssues ? 50 : 100) / 100 *
      (hasServiceRecords ? 100 : 70) / 100 *
      (previousOwners <= 2 ? 100 : 80) / 100
    )

    const riskLevel = overallScore >= 80 ? "low" :
                     overallScore >= 60 ? "medium" : "high"

    // Create AI service log
    const aiLog = await prisma.aIServiceLog.create({
      data: {
        serviceType: "HISTORY_CHECK",
        inputData: JSON.stringify({ vehicleId, vehicle }),
        resultData: JSON.stringify({
          overallScore,
          riskLevel,
          details: {
            hasAccidents,
            hasTitleIssues,
            hasServiceRecords,
            previousOwners,
            lastServiceDate: hasServiceRecords
              ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
              : null
          },
          timestamp: new Date().toISOString()
        }),
        userId: session.user.id
      }
    })

    return NextResponse.json({
      overallScore,
      riskLevel,
      details: {
        hasAccidents,
        hasTitleIssues,
        hasServiceRecords,
        previousOwners
      },
      aiLogId: aiLog.id
    })
  } catch (error) {
    console.error("Error in history check AI service:", error)
    return NextResponse.json(
      { error: "Failed to process history check request" },
      { status: 500 }
    )
  }
}