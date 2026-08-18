import { prisma } from "@/lib/prisma"
import { USER_ROLE, isAdmin, normalizeUserRole } from "@/lib/permissions"

// Магазин запчастей и доставка — это работа с чужими деньгами и товаром, а не
// частное объявление. Поэтому они открываются только компании, чьи реквизиты
// администратор сверил: роль PARTNER выдаётся при подтверждении организации,
// а не по факту регистрации.

export type PartnerAccess = {
  allowed: boolean
  /** DRAFT — заявки нет, PENDING — на проверке, REJECTED — отклонена. */
  applicationStatus: "NONE" | "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED"
  reason: string | null
}

/**
 * Проверяет, открыты ли пользователю партнёрские инструменты.
 *
 * Администратору доступ открыт всегда: иначе он не сможет вести собственный
 * магазин площадки и разбирать проблемы продавцов.
 */
export async function checkPartnerAccess(userId: string, role?: string | null): Promise<PartnerAccess> {
  if (isAdmin(role)) return { allowed: true, applicationStatus: "VERIFIED", reason: null }

  const organization = await prisma.deliveryOrganization.findFirst({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    select: { verificationStatus: true, verificationNote: true },
  })

  if (!organization) {
    return {
      allowed: false,
      applicationStatus: "NONE",
      reason: "Подайте заявку партнёра и пройдите проверку реквизитов.",
    }
  }

  if (organization.verificationStatus === "VERIFIED") {
    // Роль могла не обновиться, если заявку подтвердили до появления этой
    // проверки: статус организации здесь важнее записи в профиле.
    return { allowed: true, applicationStatus: "VERIFIED", reason: null }
  }

  const statusReason: Record<string, string> = {
    PENDING: "Заявка на проверке. Инструменты откроются после подтверждения реквизитов.",
    REJECTED: organization.verificationNote || "Заявка отклонена. Исправьте данные и подайте её повторно.",
    SUSPENDED: organization.verificationNote || "Партнёрский статус приостановлен администратором.",
  }

  return {
    allowed: false,
    applicationStatus: (organization.verificationStatus as PartnerAccess["applicationStatus"]) || "NONE",
    reason: statusReason[organization.verificationStatus] || "Партнёрский доступ недоступен.",
  }
}

/** Признак партнёра по роли — для мест, где запрос к базе избыточен. */
export function hasPartnerRole(role?: string | null) {
  const normalized = normalizeUserRole(role)
  return normalized === USER_ROLE.PARTNER || isAdmin(role)
}
