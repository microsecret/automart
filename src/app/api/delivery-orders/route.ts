import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { asTrimmedString, deliveryOrderInclude, isDeliveryAdmin } from "@/lib/delivery-access"
import { DELIVERY_COUNTRIES, DELIVERY_STATUS_META, makeDeliveryCode } from "@/lib/delivery"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const validKinds = new Set(["VEHICLE", "PART"])
const validSources = new Set(["AUCTION", "DIRECT_IMPORT", "PARTS_ORDER"])
const validCountries = new Set(DELIVERY_COUNTRIES.map((country) => country.value))

/** GET /api/delivery-orders — сделки, доступные текущему пользователю */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const where = isDeliveryAdmin(session)
      ? {}
      : {
          OR: [
            { buyerId: session.user.id },
            { partnerId: session.user.id },
            { managerId: session.user.id },
          ],
        }

    const orders = await prisma.deliveryOrder.findMany({
      where,
      include: {
        buyer: { select: { id: true, name: true } },
        partner: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        auctionListing: { select: { id: true, make: true, model: true, year: true } },
        events: { orderBy: { completedAt: "desc" }, take: 1 },
        payments: { select: { id: true, status: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    })

    const activeOrders = orders.filter((order) => !["COMPLETED", "CANCELED"].includes(order.status))
    const pendingPayments = orders.reduce((count, order) => count + order.payments.filter((payment) => ["INVOICE_ISSUED", "AWAITING_CONFIRMATION", "OVERDUE"].includes(payment.status)).length, 0)

    return NextResponse.json({
      orders,
      summary: {
        total: orders.length,
        active: activeOrders.length,
        pendingPayments,
        needsAttention: orders.filter((order) => order.status === "ON_HOLD" || order.nextActionAt && order.nextActionAt < new Date()).length,
      },
    })
  } catch (error) {
    console.error("Delivery orders GET error:", error)
    return NextResponse.json({ error: "Не удалось загрузить сделки" }, { status: 500 })
  }
}

/** POST /api/delivery-orders — покупатель создаёт заявку на сопровождение */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userLimit = rateLimit(`delivery:create:user:${session.user.id}`, { windowMs: 15 * 60_000, maxRequests: 5 })
    const ipLimit = rateLimit(`delivery:create:ip:${getClientIp(request)}`, { windowMs: 15 * 60_000, maxRequests: 12 })
    if (!userLimit.success || !ipLimit.success) {
      const limit = !userLimit.success ? userLimit : ipLimit
      return NextResponse.json(
        { error: "Слишком много заявок. Попробуйте позже." },
        { status: 429, headers: rateLimitHeaders(limit) },
      )
    }

    const body = await request.json()
    const title = asTrimmedString(body.title, 160)
    const kind = asTrimmedString(body.kind, 20) || "VEHICLE"
    const sourceType = asTrimmedString(body.sourceType, 30) || "AUCTION"
    const originCountry = asTrimmedString(body.originCountry, 12)
    const destinationCity = asTrimmedString(body.destinationCity, 120)

    if (!title || !destinationCity || !validKinds.has(kind) || !validSources.has(sourceType) || !validCountries.has(originCountry)) {
      return NextResponse.json({ error: "Проверьте вид транспорта, страну, название и город доставки" }, { status: 400 })
    }

    const auctionListingId = asTrimmedString(body.auctionListingId, 80) || null
    if (auctionListingId) {
      const auction = await prisma.auctionListing.findUnique({ where: { id: auctionListingId }, select: { id: true } })
      if (!auction) return NextResponse.json({ error: "Лот аукциона не найден" }, { status: 404 })
    }

    let order
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        order = await prisma.deliveryOrder.create({
          data: {
            code: makeDeliveryCode(),
            kind,
            sourceType,
            title,
            description: asTrimmedString(body.description, 2000) || null,
            auctionListingId,
            vin: asTrimmedString(body.vin, 32) || null,
            lotNumber: asTrimmedString(body.lotNumber, 80) || null,
            originCountry,
            originCity: asTrimmedString(body.originCity, 120) || null,
            originCheckpoint: asTrimmedString(body.originCheckpoint, 120) || null,
            destinationCity,
            destinationRegion: asTrimmedString(body.destinationRegion, 120) || null,
            buyerId: session.user.id,
            nextAction: "Менеджер проверит заявку и предложит подтверждённого партнёра",
            events: {
              create: {
                status: "REQUEST_CREATED",
                title: DELIVERY_STATUS_META.REQUEST_CREATED.label,
                description: "Заявка создана покупателем. Счета и реквизиты появятся только после согласования условий.",
                responsibleRole: "PLATFORM",
                source: "MANUAL",
                authorId: session.user.id,
              },
            },
            messages: {
              create: {
                senderId: session.user.id,
                content: "Заявка создана. Здесь появится общий чат с назначенным партнёром.",
                isSystem: true,
              },
            },
          },
          include: deliveryOrderInclude,
        })
        break
      } catch (error) {
        const isNumberCollision = error && typeof error === "object" && "code" in error && error.code === "P2002"
        if (!isNumberCollision || attempt === 2) throw error
      }
    }

    return NextResponse.json({ order }, { status: 201 })
  } catch (error) {
    console.error("Delivery order POST error:", error)
    return NextResponse.json({ error: "Не удалось создать заявку" }, { status: 500 })
  }
}
