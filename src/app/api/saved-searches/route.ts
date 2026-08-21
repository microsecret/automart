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
    const scope: SavedSearchScope = SAVED_SEARCH_SCOPES.includes(body?.scope) ? body.scope : "LISTINGS"

    // Условия приходят с клиента, поэтому чистим их сами: в базу попадают
    // только известные параметры, а не произвольная строка из адреса.
    const query = normalizeSavedSearchQuery(typeof body?.query === "string" ? body.query : "", scope)

    if (!title) return NextResponse.json({ error: "Назовите подписку" }, { status: 400 })

    const count = await prisma.savedSearch.count({ where: { userId: session.user.id } })
    if (count >= MAX_SAVED_SEARCHES) {
      return NextResponse.json(
        { error: `Больше ${MAX_SAVED_SEARCHES} подписок не сохраняется — удалите ненужные` },
        { status: 409 },
      )
    }

    const created = await prisma.savedSearch.create({
      data: {
        userId: session.user.id,
        title,
        scope,
        query,
        notifyTelegram: body?.notifyTelegram !== false,
        // Отсчёт «новых» начинается с момента подписки, иначе первое же
        // уведомление принесёт весь текущий каталог.
        lastNotifiedAt: new Date(),
      },
      select: { id: true, title: true, scope: true, query: true, notifyTelegram: true, createdAt: true },
    })

    return NextResponse.json(created, { status: 201 })
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
