import { prisma } from "@/lib/prisma"

// Решения администратора меняют видимость чужого контента, роли и статусы
// аккаунтов. Журнал делает их восстановимыми: кто, что и когда изменил,
// остаётся известным даже после удаления самой сущности или аккаунта автора.

export type AdminAuditAction =
  | "AUCTION_LOT_HIDE"
  | "AUCTION_LOT_RESTORE"
  | "USER_ROLE_CHANGE"
  | "USER_STATUS_CHANGE"
  | "LISTING_MODERATE"
  | "LISTING_REPORT_RESOLVE"
  | "DELIVERY_ORGANIZATION_VERIFY"
  | "SUPPORT_TICKET_UPDATE"
  | "FUEL_PRICE_REPORT_REJECT"
  | "PART_STORE_STATUS_CHANGE"
  /* Владелец изменил юрлицо, ИНН или контакты у проверенного магазина.
     Проверка касалась именно этих данных, поэтому магазин уходит на
     повторную модерацию, а событие попадает в журнал. */
  | "PART_STORE_LEGAL_CHANGE"
  | "REFERRAL_PAYOUT"

type AdminAuditInput = {
  actorId: string | null
  actorEmail?: string | null
  action: AdminAuditAction
  entityType: string
  entityId?: string | null
  summary: string
  metadata?: Record<string, unknown> | null
}

/**
 * Записывает решение администратора в журнал.
 *
 * Ошибка журналирования не должна отменять уже выполненное действие: запись
 * ведётся рядом с основной операцией, а не вместо неё, поэтому сбой только
 * логируется. Вызывать следует после успешного изменения.
 */
export async function recordAdminAudit(input: AdminAuditInput) {
  try {
    await prisma.adminAuditEvent.create({
      data: {
        actorId: input.actorId,
        actorEmail: input.actorEmail?.trim() || null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        summary: input.summary.trim().replace(/\s+/g, " ").slice(0, 500),
        metadata: input.metadata ? JSON.stringify(input.metadata).slice(0, 4_000) : null,
      },
    })
  } catch (error) {
    console.error("Admin audit write failed", error instanceof Error ? error.message : error)
  }
}
