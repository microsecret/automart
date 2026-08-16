import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const organizationTypes = new Set(["COMPANY", "ENTREPRENEUR", "BROKER", "LOGISTICS"])

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

function normalizeDigits(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : ""
}

/** GET /api/delivery-organizations — заявка текущего пользователя в реестр партнёров. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const organization = await prisma.deliveryOrganization.findFirst({
      where: { ownerId: session.user.id },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({ organization })
  } catch (error) {
    console.error("Delivery organization GET error:", error)
    return NextResponse.json({ error: "Не удалось загрузить заявку партнёра" }, { status: 500 })
  }
}

/** POST /api/delivery-organizations — ИП или компания подаёт реквизиты на проверку. */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userLimit = rateLimit(`delivery-organization:user:${session.user.id}`, { windowMs: 60 * 60_000, maxRequests: 4 })
    const ipLimit = rateLimit(`delivery-organization:ip:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 10 })
    if (!userLimit.success || !ipLimit.success) {
      const limit = !userLimit.success ? userLimit : ipLimit
      return NextResponse.json(
        { error: "Слишком много изменений. Повторите позже." },
        { status: 429, headers: rateLimitHeaders(limit) },
      )
    }

    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 })
    }

    const payload = body as Record<string, unknown>
    const legalName = normalizeText(payload.legalName, 180)
    const inn = normalizeDigits(payload.inn)
    const ogrn = normalizeDigits(payload.ogrn) || null
    const organizationType = normalizeText(payload.organizationType, 24)
    const serviceRegions = normalizeText(payload.serviceRegions, 700)

    if (legalName.length < 3 || !organizationTypes.has(organizationType)) {
      return NextResponse.json({ error: "Укажите название и тип организации" }, { status: 400 })
    }
    if (![10, 12].includes(inn.length)) {
      return NextResponse.json({ error: "ИНН должен содержать 10 или 12 цифр" }, { status: 400 })
    }
    if (ogrn && ![13, 15].includes(ogrn.length)) {
      return NextResponse.json({ error: "ОГРН или ОГРНИП должен содержать 13 или 15 цифр" }, { status: 400 })
    }
    if (serviceRegions.length < 2) {
      return NextResponse.json({ error: "Укажите города, регионы или направления работы" }, { status: 400 })
    }

    const [ownedOrganization, organizationWithInn] = await Promise.all([
      prisma.deliveryOrganization.findFirst({ where: { ownerId: session.user.id }, orderBy: { updatedAt: "desc" } }),
      prisma.deliveryOrganization.findUnique({ where: { inn } }),
    ])

    if (organizationWithInn && organizationWithInn.ownerId !== session.user.id) {
      return NextResponse.json({ error: "Организация с таким ИНН уже зарегистрирована" }, { status: 409 })
    }

    const data = {
      legalName,
      inn,
      ogrn,
      organizationType,
      serviceRegions: JSON.stringify(serviceRegions.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 30)),
      verificationStatus: "PENDING",
      verificationSource: null,
      fnsCheckedAt: null,
      verificationNote: null,
    }

    const organization = ownedOrganization
      ? await prisma.deliveryOrganization.update({ where: { id: ownedOrganization.id }, data })
      : await prisma.deliveryOrganization.create({ data: { ...data, ownerId: session.user.id } })

    return NextResponse.json({ organization }, { status: ownedOrganization ? 200 : 201 })
  } catch (error) {
    console.error("Delivery organization POST error:", error)
    return NextResponse.json({ error: "Не удалось отправить реквизиты на проверку" }, { status: 500 })
  }
}
