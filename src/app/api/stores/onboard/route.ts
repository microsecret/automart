import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { uniqueStoreSlug } from "@/lib/part-store-slug"
import { notifyAdmins } from "@/lib/admin-notify"

export const dynamic = "force-dynamic"

/* Формы, с которыми продаёт предприниматель. Самозанятый тоже может вести
   магазин — у него 12-значный ИНН, как у ИП. */
const SELLER_FORMS: Record<string, string> = { COMPANY: "Юрлицо", ENTREPRENEUR: "ИП", SELF_EMPLOYED: "Самозанятый" }

const readText = (value: unknown, limit: number) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) : ""

/**
 * Анкета «Открыть магазин»: проверка продавца и черновик магазина за один шаг.
 *
 * Раньше продавец заполнял анкету перевозчика (тип логиста, «города и
 * направления работы») и до её проверки не мог даже начать каталог. За всё
 * время не пришло ни одной заявки — и магазинов было ноль.
 *
 * Теперь: короткая анкета → организация «продавец запчастей» на проверке +
 * магазин-черновик. Каталог наполняется сразу; публикует его администратор,
 * и тем же действием подтверждает продавца.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Войдите, чтобы открыть магазин" }, { status: 401 })
  const userId = session.user.id

  const limit = rateLimit(`store-onboard:${userId}:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 10 })
  if (!limit.success) return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429, headers: rateLimitHeaders(limit) })

  const body = await request.json().catch(() => null)
  const storeName = readText(body?.storeName, 120)
  const legalName = readText(body?.legalName, 200)
  const inn = readText(body?.inn, 20).replace(/\D/g, "")
  const sellerForm = typeof body?.sellerForm === "string" && SELLER_FORMS[body.sellerForm] ? body.sellerForm as string : ""
  const city = readText(body?.city, 80)
  const phone = readText(body?.phone, 40)
  const email = readText(body?.email, 120)
  const sells = readText(body?.sells, 300)
  const description = readText(body?.description, 1_000)

  const fieldErrors: Record<string, string> = {}
  if (storeName.length < 3) fieldErrors.storeName = "Название магазина — от трёх символов"
  if (!sellerForm) fieldErrors.sellerForm = "Выберите форму: ИП, юрлицо или самозанятый"
  if (legalName.length < 3) fieldErrors.legalName = "Укажите юрлицо, ИП или ФИО самозанятого"
  if (sellerForm && (sellerForm === "COMPANY" ? inn.length !== 10 : inn.length !== 12)) {
    fieldErrors.inn = sellerForm === "COMPANY" ? "ИНН юрлица — 10 цифр" : "ИНН ИП и самозанятого — 12 цифр"
  }
  if (city.length < 2) fieldErrors.city = "Укажите город"
  if (phone.replace(/\D/g, "").length < 10) fieldErrors.phone = "Телефон для связи с покупателями"
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Проверьте адрес почты"
  if (Object.keys(fieldErrors).length) {
    return NextResponse.json({ error: Object.values(fieldErrors)[0], fieldErrors }, { status: 422 })
  }

  const existingStore = await prisma.partStore.findFirst({ where: { ownerId: userId }, select: { id: true } })
  if (existingStore) {
    return NextResponse.json({ error: "У вас уже есть магазин — он в кабинете продавца", storeId: existingStore.id }, { status: 409 })
  }

  /* ИНН уникален среди организаций: один ИНН — один продавец. Свою же
     прежнюю организацию (например, партнёра доставки) переиспользуем, а
     отклонённую анкету продавца возвращаем на проверку. */
  const innOwner = await prisma.deliveryOrganization.findUnique({
    where: { inn },
    select: { id: true, ownerId: true, organizationType: true, verificationStatus: true },
  })
  if (innOwner && innOwner.ownerId !== userId) {
    return NextResponse.json({ error: "Этот ИНН уже зарегистрирован другим аккаунтом. Напишите в поддержку.", fieldErrors: { inn: "ИНН уже зарегистрирован" } }, { status: 409 })
  }

  const note = `${SELLER_FORMS[sellerForm]}${sells ? `. Продаёт: ${sells}` : ""}`.slice(0, 500)
  const slug = await uniqueStoreSlug(storeName)
  const { store, organizationId } = await prisma.$transaction(async (tx) => {
    let organizationId: string
    if (!innOwner) {
      const created = await tx.deliveryOrganization.create({
        data: {
          ownerId: userId, legalName, inn,
          organizationType: "PARTS_SELLER",
          serviceRegions: JSON.stringify([city]),
          verificationStatus: "PENDING",
          verificationNote: note,
        },
        select: { id: true },
      })
      organizationId = created.id
    } else {
      organizationId = innOwner.id
      if (innOwner.organizationType === "PARTS_SELLER" && innOwner.verificationStatus === "REJECTED") {
        await tx.deliveryOrganization.update({
          where: { id: innOwner.id },
          data: { legalName, verificationStatus: "PENDING", verificationNote: note },
        })
      }
    }
    const created = await tx.partStore.create({
      data: {
        ownerId: userId,
        name: storeName,
        slug,
        description: description || null,
        city,
        legalName,
        inn,
        contactPhone: phone,
        contactEmail: email || null,
        status: "DRAFT",
      },
      select: { id: true, name: true, slug: true, status: true },
    })
    return { store: created, organizationId }
  })

  await notifyAdmins({
    title: "Новая анкета продавца",
    lines: [
      `Магазин «${storeName}», ${city}`,
      `${SELLER_FORMS[sellerForm]}: ${legalName}, ИНН ${inn}`,
      `Телефон: ${phone}`,
      sells ? `Продаёт: ${sells}` : "",
      "Магазин пока черновик: продавец наполняет каталог. Реквизиты можно сверить сейчас.",
    ],
    relatedType: "PART_STORE",
    relatedId: store.id,
    adminPath: "/admin",
    buttonText: "Открыть админку",
  })

  return NextResponse.json({ store, organizationId }, { status: 201 })
}
