import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/news"
import { checkPartnerAccess } from "@/lib/partner-access"

export const dynamic = "force-dynamic"

const MAX_STORES_PER_USER = 3

function readText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) || null : null
}

/** Возвращает магазины текущего продавца. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  const stores = await prisma.partStore.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, slug: true, description: true, city: true, status: true, statusReason: true,
      legalName: true, inn: true, contactPhone: true, contactEmail: true,
      defaultLeadTimeDaysMin: true, defaultLeadTimeDaysMax: true, defaultOriginCountry: true,
      createdAt: true,
      _count: { select: { parts: true } },
    },
  })

  // Статус нужен интерфейсу: у непроверенного продавца вместо формы должно
  // быть объяснение, что делать дальше, а не пустой кабинет.
  const access = await checkPartnerAccess(session.user.id, session.user.role)
  return NextResponse.json({ stores, access })
}

/** Создаёт витрину продавца. */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const name = readText(body?.name, 120)
  if (!name || name.length < 3) {
    return NextResponse.json({ error: "Укажите название магазина от трёх символов" }, { status: 400 })
  }

  // Витрину открывает только проверенная компания: магазин принимает заказы
  // и контакты покупателей, поэтому реквизиты должны быть сверены заранее.
  const access = await checkPartnerAccess(session.user.id, session.user.role)
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.reason, applicationStatus: access.applicationStatus },
      { status: 403 },
    )
  }

  const existing = await prisma.partStore.count({ where: { ownerId: session.user.id } })
  if (existing >= MAX_STORES_PER_USER) {
    return NextResponse.json({ error: `Один аккаунт может вести не больше ${MAX_STORES_PER_USER} магазинов` }, { status: 409 })
  }

  // Адрес витрины должен быть уникальным и читаемым: к базовому slug
  // добавляется суффикс, только если имя уже занято.
  const baseSlug = slugify(name) || "store"
  let slug = baseSlug
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const taken = await prisma.partStore.findUnique({ where: { slug }, select: { id: true } })
    if (!taken) break
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
  }

  const store = await prisma.partStore.create({
    data: {
      ownerId: session.user.id,
      name,
      slug,
      description: readText(body?.description, 1_000),
      city: readText(body?.city, 80),
      legalName: readText(body?.legalName, 200),
      inn: readText(body?.inn, 20),
      contactPhone: readText(body?.contactPhone, 40),
      contactEmail: readText(body?.contactEmail, 120),
      defaultOriginCountry: readText(body?.defaultOriginCountry, 4),
      // Магазин открывается как черновик: витрина становится публичной после
      // проверки, поэтому непроверенный продавец не появляется в каталоге.
      status: "DRAFT",
    },
    select: { id: true, name: true, slug: true, status: true },
  })

  return NextResponse.json({ store }, { status: 201 })
}
