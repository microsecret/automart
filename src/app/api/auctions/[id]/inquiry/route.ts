import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { normalizePhone } from "@/lib/telegram"
import { routeAuctionInquiryToPartners } from "@/lib/auction-partner-routing"
import { buildPublicAuctionPolicy } from "@/lib/auction-public-catalog"

export const dynamic = "force-dynamic"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized ? normalized.slice(0, maxLength) : null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Войдите в аккаунт, чтобы заявка, чат и документы появились в личном кабинете." },
        { status: 401 },
      )
    }
    const { id } = await params
    const ipLimit = rateLimit(`auction-inquiry:ip:${getClientIp(request)}`, { windowMs: 15 * 60 * 1000, maxRequests: 8 })
    if (!ipLimit.success) {
      return NextResponse.json(
        { error: "Слишком много заявок. Попробуйте позднее." },
        { status: 429, headers: rateLimitHeaders(ipLimit) },
      )
    }

    const body = await request.json().catch(() => null)
    const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {}
    const name = readOptionalText(input.name, 100)
    const phone = normalizePhone(input.phone)
    const email = readOptionalText(input.email, 254)
    const city = readOptionalText(input.city, 120)
    const comment = readOptionalText(input.comment, 2000)
    if (!name || !phone || !city) return NextResponse.json({ error: "Укажите имя, город доставки и корректный номер телефона" }, { status: 400 })
    if (email && !EMAIL_PATTERN.test(email)) return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 })

    const phoneLimit = rateLimit(`auction-inquiry:phone:${phone}`, { windowMs: 60 * 60 * 1000, maxRequests: 3 })
    if (!phoneLimit.success) {
      return NextResponse.json(
        { error: "С этого номера уже отправлено слишком много заявок. Попробуйте позднее." },
        { status: 429, headers: rateLimitHeaders(phoneLimit) },
      )
    }

    /* Условие берётся из общей политики каталога, а не пишется заново.

       Здесь стояла своя проверка, не учитывавшая скрытие модератором.
       На боевой базе каталог показывал 3763 лота, а заявка принималась
       по 3793: тридцать один скрытый лот принимал заявки, среди них
       скрытый с причиной «нет ни одной пригодной фотографии». Партнёр
       получал заявку на машину, которую площадка сама сняла с показа. */
    const listing = await prisma.auctionListing.findFirst({
      where: { ...buildPublicAuctionPolicy().where, id },
      select: { id: true },
    })
    if (!listing) return NextResponse.json({ error: "Лот недоступен" }, { status: 404 })

    const inquiry = await prisma.auctionInquiry.create({
      data: {
        auctionListingId: listing.id,
        name,
        phone,
        email,
        city,
        comment,
        requesterId: session.user.id,
      },
      select: { id: true, createdAt: true },
    })
    const routing = await routeAuctionInquiryToPartners(inquiry.id).catch((routingError: unknown) => {
      console.error("Auction inquiry partner routing error:", routingError)
      return { offered: 0 }
    })
    return NextResponse.json({ success: true, inquiry, routing }, { status: 201 })
  } catch (error) {
    console.error("Inquiry error:", error)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
