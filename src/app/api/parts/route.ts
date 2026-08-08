import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "../auth/[...nextauth]/route"
import axios from "axios"
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
    const {
      name,
      description,
      price,
      condition,
      make,
      model,
      yearFrom,
      yearTo,
      partType,
      location,
      images
    } = body

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Part name is required" },
        { status: 400 }
      )
    }

    if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
      return NextResponse.json(
        { error: "Valid price is required" },
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

    // Create the part
    const part = await prisma.part.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        price: parseInt(price),
        condition: condition ? condition.trim() : null,
        make: make ? make.trim() : null,
        model: model ? model.trim() : null,
        yearFrom: yearFrom ? parseInt(yearFrom) : null,
        yearTo: yearTo ? parseInt(yearTo) : null,
        partType: partType ? partType.trim() : null,
        location: location ? location.trim() : null,
        images: images || null, // Expecting JSON string of array or null
        userId: session.user.id,
        lat,
        lng
      }
    })

    return NextResponse.json(part, { status: 201 })
  } catch (error) {
    console.error("Error creating part:", error)
    return NextResponse.json(
      { error: "Failed to create part" },
      { status: 500 }
    )
  }
}