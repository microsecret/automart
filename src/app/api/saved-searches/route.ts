import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { normalizeSavedSearchQuery, SAVED_SEARCH_SCOPES, type SavedSearchScope } from "@/lib/saved-search"

export const dynamic = "force-dynamic"

/** Больше двадцати подписок один человек не отслеживает — это уже свалка. */
const MAX_SAVED_SEARCHES = 20

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const searches = await prisma.savedSearch.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, scope: true, query: true,
        notifyTelegram: true, lastMatchCount: true, createdAt: true,
      },
    })
    return NextResponse.json({ searches })
  } catch (error) {
    console.error("Saved searches GET error:", error)
    return NextResponse.json({ error: "Не удалось загрузить подписки" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const limit = rateLimit(`saved-search:${session.user.id || getClientIp(request)}`, {
    windowMs: 60_000,
    maxRequests: 10,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: "Слишком часто. Повторите через минуту." },
      { status: 429, headers: rateLimitHeaders(limit) },
    )
  }

  try {
    const body = await request.json().catch(() => null)
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : ""
    if (!SAVED_SEARCH_SCOPES.includes(body?.scope)) {
      return NextResponse.json({ error: "Выберите корректный раздел поиска" }, { status: 400 })
    }
    const scope: SavedSearchScope = body.scope
    if (typeof body?.query !== "string" || body.query.length > 4096) {
      return NextResponse.json({ error: "Слишком длинные или некорректные условия поиска" }, { status: 400 })
    }

    // Условия приходят с клиента, поэтому чистим их сами: в базу попадают
    // только известные параметры, а не произвольная строка из адреса.
    const query = normalizeSavedSearchQuery(typeof body?.query === "string" ? body.query : "", scope)

    if (!title) return NextResponse.json({ error: "Назовите подписку" }, { status: 400 })

    const result = await prisma.$transaction(async (tx) => {
      // Check identity before capacity: retrying an existing subscription at
      // the limit must not create another row or reset its notification clock.
      const existing = await tx.savedSearch.findFirst({
        where: { userId: session.user.id, scope, query },
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, scope: true, query: true, notifyTelegram: true, createdAt: true },
      })
      if (existing) return { search: existing, alreadySaved: true }
      const count = await tx.savedSearch.count({ where: { userId: session.user.id } })
      if (count >= MAX_SAVED_SEARCHES) return null
      const search = await tx.savedSearch.create({
        data: {
          userId: session.user.id, title, scope, query,
          notifyTelegram: body?.notifyTelegram !== false,
          lastNotifiedAt: new Date(),
        },
        select: { id: true, title: true, scope: true, query: true, notifyTelegram: true, createdAt: true },
      })
      return { search, alreadySaved: false }
    })
    if (!result) {
      return NextResponse.json(
        { error: `Больше ${MAX_SAVED_SEARCHES} подписок не сохраняется — удалите ненужные` },
        { status: 409 },
      )
    }

    return NextResponse.json({ ...result.search, alreadySaved: result.alreadySaved }, { status: result.alreadySaved ? 200 : 201 })
  } catch (error) {
    console.error("Saved searches POST error:", error)
    return NextResponse.json({ error: "Не удалось сохранить подписку" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const id = new URL(request.url).searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Не указана подписка" }, { status: 400 })

    // Удаляем с проверкой владельца: без неё чужой идентификатор снёс бы
    // подписку другого человека.
    const removed = await prisma.savedSearch.deleteMany({
      where: { id, userId: session.user.id },
    })
    if (removed.count === 0) return NextResponse.json({ error: "Подписка не найдена" }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Saved searches DELETE error:", error)
    return NextResponse.json({ error: "Не удалось удалить подписку" }, { status: 500 })
  }
}
