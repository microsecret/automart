import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import { PrismaClient } from "@prisma/client"
import axios from "axios"

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
    const {
      make,
      model,
      year,
      price,
      mileage,
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

    if (!year || isNaN(Number(year)) || Number(year) < 1886) {
      return NextResponse.json(
        { error: "Valid year is required (after 1886)" },
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
    const vehicle = await prisma.vehicle.create({
      data: {
        make: make.trim(),
        model: model.trim(),
        year: parseInt(year),
        price: parseInt(price),
        mileage: mileage ? parseInt(mileage) : null,
        vin: vin ? vin.trim() : null,
        fuelType: fuelType ? fuelType.trim() : null,
        transmission: transmission ? transmission.trim() : null,
        bodyType: bodyType ? bodyType.trim() : null,
        color: color ? color.trim() : null,
        doors: doors ? parseInt(doors) : null,
        engineVolume: engineVolume ? parseFloat(engineVolume) : null,
        power: power ? parseInt(power) : null,
        driveType: driveType ? driveType.trim() : null,
        condition: condition ? condition.trim() : null,
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