import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { publicListingWhere } from "@/lib/listing-lifecycle"

function currentUserFavoritesWhere(userId: string) {
  return {
    ...publicListingWhere,
    favoritedBy: { some: { id: userId } },
  }
}

// GET all favorite listings for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Необходимо войти в аккаунт" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Handle special case for count only
    if (searchParams.get("countOnly") === "true") {
      const count = await prisma.listing.count({
        where: currentUserFavoritesWhere(session.user.id)
      })

      return NextResponse.json({ count })
    }

    // Compact representation for catalog cards. This avoids loading complete
    // listing records once per card just to determine whether the heart is on.
    if (searchParams.get("idsOnly") === "true") {
      const favorites = await prisma.listing.findMany({
        where: currentUserFavoritesWhere(session.user.id),
        select: { id: true },
        /* Предел обязателен: ветка вызывается при каждой отрисовке
           каталога, чтобы подсветить сохранённые карточки. Тысяча с
           запасом покрывает любое разумное избранное — соседняя ветка
           этого маршрута предел уже ставит. */
        take: 1_000,
        orderBy: { createdAt: "desc" },
      })

      return NextResponse.json({
        ids: favorites.map((favorite) => favorite.id),
        count: favorites.length
      })
    }

    // Параметры приходят из адресной строки: «page=abc» давал NaN, «page=-5» —
    // отрицательный skip, на котором запрос падает, а «limit=999999» выгружал
    // всё избранное одним ответом.
    const requestedPage = Number(searchParams.get("page") || "1")
    const requestedLimit = Number(searchParams.get("limit") || "20")
    // Number.isInteger(1e308) === true, поэтому одной проверки на целое мало:
    // без верхней границы skip уходит в Infinity и запрос падает.
    const page = Number.isInteger(requestedPage) ? Math.min(Math.max(requestedPage, 1), 10_000) : 1
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20
    const skip = (page - 1) * limit

    // Get favorite listings for the current user
    const [favorites, total] = await prisma.$transaction([
      prisma.listing.findMany({
        where: currentUserFavoritesWhere(session.user.id),
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
        where: currentUserFavoritesWhere(session.user.id)
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
      { error: "Не удалось загрузить избранное" },
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
        { error: "Необходимо войти в аккаунт" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { listingId } = body

    // Validation
    if (!listingId) {
      return NextResponse.json(
        { error: "Не указан идентификатор объявления" },
        { status: 400 }
      )
    }

    // Verify listing exists
    const listing = await prisma.listing.findFirst({
      where: { id: listingId, ...publicListingWhere },
      select: { id: true }
    })

    if (!listing) {
      return NextResponse.json(
        { error: "Объявление не найдено" },
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
        { error: "Объявление уже в избранном" },
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
      { error: "Не удалось добавить в избранное" },
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
        { error: "Необходимо войти в аккаунт" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const listingId = searchParams.get("listingId")

    // Validation
    if (!listingId) {
      return NextResponse.json(
        { error: "Не указан идентификатор объявления" },
        { status: 400 }
      )
    }

    /* Проверки существования здесь нет, и это намеренно.

       Она отвечала по-разному на существующий и несуществующий
       идентификатор: перебором можно было узнать, какие объявления есть
       в базе, включая черновики и снятые с публикации.

       Она же мешала делу: объявление могло стать непубличным уже после
       добавления в избранное, и убрать его оттуда стало бы нельзя.

       Отсоединение безопасно само по себе — оно идёт по идентификатору
       вошедшего и ничего не делает, если связи нет. */
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
      { error: "Не удалось убрать из избранного" },
      { status: 500 }
    )
  }
}
