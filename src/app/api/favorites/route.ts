import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
// GET all favorite listings for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Handle special case for count only
    if (searchParams.get("countOnly") === "true") {
      const count = await prisma.listing.count({
        where: {
          favoritedBy: {
            some: {
              id: session.user.id
            }
          }
        }
      })

      return NextResponse.json({ count })
    }

    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    // Get favorite listings for the current user
    const [favorites, total] = await prisma.$transaction([
      prisma.listing.findMany({
        where: {
          favoritedBy: {
            some: {
              id: session.user.id
            }
          }
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
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc"
        }
      }),
      prisma.listing.count({
        where: {
          favoritedBy: {
            some: {
              id: session.user.id
            }
          }
        }
      })
    ])

    return NextResponse.json({
      favorites,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching favorites:", error)
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 }
    )
  }
}

// POST add a listing to favorites
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
    const { listingId } = body

    // Validation
    if (!listingId) {
      return NextResponse.json(
        { error: "Listing ID is required" },
        { status: 400 }
      )
    }

    // Verify listing exists
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true }
    })

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      )
    }

    // Check if already in favorites
    const existingFavorite = await prisma.user.findFirst({
      where: {
        id: session.user.id,
        favoriteListings: {
          some: {
            id: listingId
          }
        }
      },
      select: {
        id: true
      }
    })

    if (existingFavorite) {
      return NextResponse.json(
        { error: "Listing is already in favorites" },
        { status: 409 } // Conflict
      )
    }

    // Add to favorites
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        favoriteListings: {
          connect: {
            id: listingId
          }
        }
      }
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error("Error adding to favorites:", error)
    return NextResponse.json(
      { error: "Failed to add to favorites" },
      { status: 500 }
    )
  }
}

// DELETE remove a listing from favorites
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const listingId = searchParams.get("listingId")

    // Validation
    if (!listingId) {
      return NextResponse.json(
        { error: "Listing ID is required" },
        { status: 400 }
      )
    }

    // Verify listing exists
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { id: true }
    })

    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 }
      )
    }

    // Remove from favorites
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        favoriteListings: {
          disconnect: {
            id: listingId
          }
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing from favorites:", error)
    return NextResponse.json(
      { error: "Failed to remove from favorites" },
      { status: 500 }
    )
  }
}
