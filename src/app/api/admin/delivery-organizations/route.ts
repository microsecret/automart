import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin-route-guard"
import { prisma } from "@/lib/prisma"
import { USER_ROLE } from "@/lib/permissions"
import { adminAuditValueLabel, recordAdminAudit } from "@/lib/admin-audit"

export const dynamic = "force-dynamic"

const verificationStatuses = new Set(["PENDING", "VERIFIED", "REJECTED", "SUSPENDED"])
const verificationSources = new Set(["MANUAL", "FNS", "PARTNER"])

function parseLimit(value: string | null) {
  if (value === null) return 30
  if (!/^\d+$/.test(value)) return null

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

/** GET /api/admin/delivery-organizations — реестр партнёров для проверки администратором. */
export async function GET(request: NextRequest) {
  try {
    const guard = await requireAdminSession()
    if (guard.denied) return guard.denied

    const status = request.nextUrl.searchParams.get("status") || "PENDING"
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"))
    if (!verificationStatuses.has(status) || limit === null) {
      return NextResponse.json({ error: "Некорректные параметры запроса" }, { status: 400 })
    }

    const [organizations, grouped] = await Promise.all([
      prisma.deliveryOrganization.findMany({
        where: { verificationStatus: status },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: limit,
        include: {
          owner: { select: { id: true, name: true, email: true, telegramUsername: true } },
        },
      }),
      prisma.deliveryOrganization.groupBy({
        by: ["verificationStatus"],
        _count: { _all: true },
      }),
    ])

    const summary = grouped.reduce<Record<string, number>>((result, item) => {
      result[item.verificationStatus] = item._count._all
      return result
    }, {})

    return NextResponse.json({ organizations, summary })
  } catch (error) {
    console.error("Admin delivery organizations GET error:", error)
    return NextResponse.json({ error: "Не удалось загрузить реестр партнёров" }, { status: 500 })
  }
}

/** PATCH /api/admin/delivery-organizations — фиксирует решение администратора по реквизитам. */
export async function PATCH(request: NextRequest) {
  try {
    const guard = await requireAdminSession()
    if (guard.denied) return guard.denied
    const session = guard.session

    const payload: unknown = await request.json().catch(() => null)
    if (!isPlainObject(payload)) return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 })

    const id = typeof payload.id === "string" ? payload.id.trim() : ""
    const verificationStatus = typeof payload.verificationStatus === "string" ? payload.verificationStatus : ""
    const sourceWasProvided = Object.prototype.hasOwnProperty.call(payload, "verificationSource")
    const noteWasProvided = Object.prototype.hasOwnProperty.call(payload, "verificationNote")
    const verificationSource = payload.verificationSource
    const verificationNote = payload.verificationNote
    const normalizedSource = typeof verificationSource === "string" ? verificationSource : null

    if (!id || !verificationStatuses.has(verificationStatus)) {
      return NextResponse.json({ error: "Укажите партнёра и корректный статус проверки" }, { status: 400 })
    }
    if (sourceWasProvided && verificationSource !== null && (typeof verificationSource !== "string" || !verificationSources.has(verificationSource))) {
      return NextResponse.json({ error: "Некорректный источник проверки" }, { status: 400 })
    }
    if (noteWasProvided && verificationNote !== null && (typeof verificationNote !== "string" || verificationNote.trim().length > 1000)) {
      return NextResponse.json({ error: "Комментарий проверки не должен превышать 1000 символов" }, { status: 400 })
    }

    const organization = await prisma.deliveryOrganization.findUnique({
      where: { id },
      select: {
        id: true,
        legalName: true,
        verificationStatus: true,
        verificationSource: true,
        owner: { select: { id: true, role: true } },
      },
    })
    if (!organization) return NextResponse.json({ error: "Партнёр не найден" }, { status: 404 })

    const updated = await prisma.$transaction(async (tx) => {
      const organizationWithOwner = await tx.deliveryOrganization.update({
        where: { id },
        data: {
          verificationStatus,
          ...(sourceWasProvided ? { verificationSource: normalizedSource } : {}),
          ...(normalizedSource === "FNS" ? { fnsCheckedAt: new Date() } : {}),
          ...(noteWasProvided ? { verificationNote: typeof verificationNote === "string" && verificationNote.trim() ? verificationNote.trim() : null } : {}),
        },
        include: {
          owner: { select: { id: true, name: true, email: true, telegramUsername: true, role: true, emailVerified: true, telegramVerifiedAt: true } },
        },
      })

      const owner = organizationWithOwner.owner
      if (verificationStatus === "VERIFIED" && [USER_ROLE.USER, USER_ROLE.VERIFIED_USER].includes(owner.role as typeof USER_ROLE.USER | typeof USER_ROLE.VERIFIED_USER)) {
        await tx.user.update({ where: { id: owner.id }, data: { role: USER_ROLE.PARTNER } })
        owner.role = USER_ROLE.PARTNER
      } else if (verificationStatus !== "VERIFIED" && owner.role === USER_ROLE.PARTNER) {
        const fallbackRole = owner.emailVerified || owner.telegramVerifiedAt ? USER_ROLE.VERIFIED_USER : USER_ROLE.USER
        await tx.user.update({ where: { id: owner.id }, data: { role: fallbackRole } })
        owner.role = fallbackRole
      }

      return organizationWithOwner
    })

    await recordAdminAudit({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "DELIVERY_ORGANIZATION_VERIFY",
      entityType: "DeliveryOrganization",
      entityId: id,
      summary: `Партнёр «${organization.legalName}»: проверка «${adminAuditValueLabel(organization.verificationStatus)}» → «${adminAuditValueLabel(verificationStatus)}»`,
      metadata: {
        previousStatus: organization.verificationStatus,
        nextStatus: verificationStatus,
        previousSource: organization.verificationSource,
        nextSource: sourceWasProvided ? normalizedSource : organization.verificationSource,
        previousOwnerRole: organization.owner.role,
        nextOwnerRole: updated.owner.role,
        noteUpdated: noteWasProvided,
      },
    })

    return NextResponse.json({ organization: updated })
  } catch (error) {
    console.error("Admin delivery organization PATCH error:", error)
    return NextResponse.json({ error: "Не удалось сохранить решение по партнёру" }, { status: 500 })
  }
}
