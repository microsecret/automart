import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/permissions"
import { adminAuditValueLabel, recordAdminAudit } from "@/lib/admin-audit"
import { USER_ROLE } from "@/lib/permissions"
import { notifyAdmins } from "@/lib/admin-notify"

export const dynamic = "force-dynamic"

// Витрина попадает в поиск и к покупателям, поэтому публикует её
// администратор, а не сам продавец. Владелец может только отправить заявку и
// вернуть магазин в черновик, пока тот не одобрен.
const OWNER_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  DRAFT: ["PENDING"],
  PENDING: ["DRAFT"],
  SUSPENDED: ["PENDING"],
  ACTIVE: ["DRAFT"],
}

const ADMIN_STATUSES = new Set(["DRAFT", "PENDING", "ACTIVE", "SUSPENDED"])

function readText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, limit) || null : null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })

  const store = await prisma.partStore.findUnique({
    where: { id },
    select: {
      id: true, ownerId: true, name: true, status: true,
      // Нужны для сравнения: правка юридических данных снимает отметку
      // о проверке, а правка названия или города — нет.
      legalName: true, inn: true, contactPhone: true, contactEmail: true, ogrn: true, legalAddress: true, sellerType: true,
      _count: { select: { parts: true } },
    },
  })
  if (!store) return NextResponse.json({ error: "Магазин не найден" }, { status: 404 })

  const admin = isAdmin(session.user.role)
  const owner = store.ownerId === session.user.id
  if (!admin && !owner) return NextResponse.json({ error: "Нет доступа к этому магазину" }, { status: 403 })

  const body = await request.json().catch(() => null)
  const nextStatus = typeof body?.status === "string" ? body.status : null
  const reason = readText(body?.statusReason, 500)

  // Обновление профиля витрины доступно владельцу и администратору.
  if (!nextStatus) {
    /* Правка юридических данных снимает отметку о проверке.

       Модерация проверяет магазин по реквизитам: юрлицо, ИНН, телефон,
       почта. Раньше их можно было поменять на уже проверенном магазине
       обычным сохранением профиля — витрина продолжала показывать
       «проверено», но проверенных данных там больше не было. Следа в
       журнале тоже не оставалось.

       Название, описание и город к проверке не относятся: их правка
       статуса не меняет. */
    const LEGAL_FIELDS = ["legalName", "inn", "contactPhone", "contactEmail", "ogrn", "legalAddress"] as const
    const changedLegalFields = LEGAL_FIELDS.filter((field) => {
      if (body?.[field] === undefined) return false
      const next = readText(body[field], 200)
      return next !== (store as Record<string, unknown>)[field]
    })
    const needsRemoderation = !admin && store.status === "ACTIVE" && changedLegalFields.length > 0

    const updated = await prisma.partStore.update({
      where: { id },
      data: {
        ...(needsRemoderation
          ? { status: "PENDING", statusReason: "Изменены юридические данные: требуется повторная проверка" }
          : {}),
        ...(body?.name !== undefined ? { name: readText(body.name, 120) || store.name } : {}),
        ...(body?.description !== undefined ? { description: readText(body.description, 1_000) } : {}),
        ...(body?.city !== undefined ? { city: readText(body.city, 80) } : {}),
        ...(body?.legalName !== undefined ? { legalName: readText(body.legalName, 200) } : {}),
        ...(body?.inn !== undefined ? { inn: readText(body.inn, 20) } : {}),
        ...(body?.contactPhone !== undefined ? { contactPhone: readText(body.contactPhone, 40) } : {}),
        ...(body?.contactEmail !== undefined ? { contactEmail: readText(body.contactEmail, 120) } : {}),
        ...(body?.ogrn !== undefined ? { ogrn: readText(body.ogrn, 20)?.replace(/\D/g, "") || null } : {}),
        ...(body?.legalAddress !== undefined ? { legalAddress: readText(body.legalAddress, 300) } : {}),
        ...(body?.sellerType !== undefined && ["COMPANY", "ENTREPRENEUR", "SELF_EMPLOYED"].includes(String(body.sellerType)) ? { sellerType: String(body.sellerType) } : {}),
        ...(body?.defaultOriginCountry !== undefined ? { defaultOriginCountry: readText(body.defaultOriginCountry, 4) } : {}),
        ...(body?.defaultLeadTimeDaysMin !== undefined ? { defaultLeadTimeDaysMin: Number.isFinite(Number(body.defaultLeadTimeDaysMin)) ? Number(body.defaultLeadTimeDaysMin) : null } : {}),
        ...(body?.defaultLeadTimeDaysMax !== undefined ? { defaultLeadTimeDaysMax: Number.isFinite(Number(body.defaultLeadTimeDaysMax)) ? Number(body.defaultLeadTimeDaysMax) : null } : {}),
      },
      select: { id: true, name: true, slug: true, status: true, statusReason: true },
    })

    // Запись в журнал: подмена реквизитов на проверенном магазине —
    // событие, о котором модерация должна узнать.
    if (needsRemoderation) {
      await recordAdminAudit({
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "PART_STORE_LEGAL_CHANGE",
        entityType: "PartStore",
        entityId: id,
        summary: `Магазин «${store.name}»: владелец изменил реквизиты — статус «${adminAuditValueLabel(store.status)}» → «${adminAuditValueLabel("PENDING")}»`,
        metadata: { changedFields: changedLegalFields, previousStatus: store.status },
      })
    }

    return NextResponse.json({ store: updated })
  }

  if (admin) {
    if (!ADMIN_STATUSES.has(nextStatus)) {
      return NextResponse.json({ error: "Недопустимый статус" }, { status: 400 })
    }
    if (nextStatus === "SUSPENDED" && !reason) {
      return NextResponse.json({ error: "Укажите причину приостановки" }, { status: 400 })
    }

    /* Публикация магазина подтверждает и продавца, пришедшего через анкету
       /sell: администратор сверяет реквизиты один раз, а не в двух
       разделах. Организации перевозчиков здесь не трогаются — их
       проверяют в «Партнёрах». */
    const { updated, sellerVerified } = await prisma.$transaction(async (tx) => {
      const saved = await tx.partStore.update({
        where: { id },
        data: { status: nextStatus, statusReason: nextStatus === "ACTIVE" ? null : reason },
        select: { id: true, status: true, statusReason: true },
      })
      if (nextStatus !== "ACTIVE") return { updated: saved, sellerVerified: false }
      const verified = await tx.deliveryOrganization.updateMany({
        where: { ownerId: store.ownerId, organizationType: "PARTS_SELLER", verificationStatus: "PENDING" },
        data: { verificationStatus: "VERIFIED", verificationSource: "MANUAL" },
      })
      if (verified.count > 0) {
        await tx.user.updateMany({
          where: { id: store.ownerId, role: { in: [USER_ROLE.USER, USER_ROLE.VERIFIED_USER] } },
          data: { role: USER_ROLE.PARTNER },
        })
      }
      return { updated: saved, sellerVerified: verified.count > 0 }
    })

    await recordAdminAudit({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "PART_STORE_STATUS_CHANGE",
      entityType: "PartStore",
      entityId: id,
      summary: `Магазин «${store.name}»: статус «${adminAuditValueLabel(store.status)}» → «${adminAuditValueLabel(nextStatus)}»${reason ? `; причина: ${reason}` : ""}`,
      metadata: { previousStatus: store.status, nextStatus, reason, sellerVerified },
    })

    return NextResponse.json({ store: updated })
  }

  const allowed = OWNER_TRANSITIONS[store.status] || []
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json({ error: "Такой переход статуса недоступен" }, { status: 409 })
  }
  // Пустая витрина в проверке бессмысленна: администратору нечего смотреть,
  // а покупатель попал бы на страницу без товаров.
  if (nextStatus === "PENDING" && store._count.parts === 0) {
    return NextResponse.json({ error: "Добавьте хотя бы одну позицию перед отправкой на проверку" }, { status: 409 })
  }
  /* Покупатель обязан видеть, кто продаёт: наименование, ОГРН или
     ОГРНИП и адрес (ЗоЗПП ст. 9 п. 1.2). У самозанятого ОГРН нет — ИНН. */
  if (nextStatus === "PENDING") {
    const missing = [
      !store.legalName && "юрлицо или ФИО",
      !store.inn && "ИНН",
      store.sellerType !== "SELF_EMPLOYED" && !store.ogrn && "ОГРН или ОГРНИП",
      !store.legalAddress && "адрес",
      !store.contactPhone && "телефон",
    ].filter(Boolean)
    if (missing.length) {
      return NextResponse.json({ error: `Заполните реквизиты в карточке магазина: ${missing.join(", ")} — их показывают покупателю по закону о защите прав потребителей` }, { status: 409 })
    }
  }

  const updated = await prisma.partStore.update({
    where: { id },
    data: { status: nextStatus, statusReason: null },
    select: { id: true, status: true, statusReason: true },
  })
  /* Магазин в очереди проверки — администратор узнаёт сразу, а не когда
     случайно заглянет в раздел: продавец ждёт публикации, чтобы продавать. */
  if (nextStatus === "PENDING") {
    await notifyAdmins({
      title: "Магазин ждёт публикации",
      lines: [`«${store.name}»: ${store._count.parts} позиций в каталоге`, store.legalName ? `${store.legalName}${store.inn ? `, ИНН ${store.inn}` : ""}` : ""],
      relatedType: "PART_STORE",
      relatedId: id,
      adminPath: "/admin",
      buttonText: "Открыть админку",
    })
  }
  return NextResponse.json({ store: updated })
}
