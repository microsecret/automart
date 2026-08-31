import { prisma } from "@/lib/prisma"

// Решения администратора меняют видимость чужого контента, роли и статусы
// аккаунтов. Журнал делает их восстановимыми: кто, что и когда изменил,
// остаётся известным даже после удаления самой сущности или аккаунта автора.

export type AdminAuditAction =
  | "AUCTION_LOT_HIDE"
  | "AUCTION_LOT_RESTORE"
  | "USER_ROLE_CHANGE"
  | "USER_STATUS_CHANGE"
  | "USER_NOTIFICATION_SEND"
  | "LISTING_MODERATE"
  | "LISTING_REMOVE"
  | "LISTING_READINESS_ENFORCE"
  | "LISTING_READINESS_RESTORE"
  | "LISTING_REPORT_RESOLVE"
  | "DELIVERY_ORGANIZATION_VERIFY"
  | "AUCTION_INQUIRY_ASSIGN"
  | "AUCTION_INQUIRY_UPDATE"
  | "SUPPORT_TICKET_UPDATE"
  | "SUPPORT_TICKET_REPLY"
  | "TELEGRAM_BROADCAST_SEND"
  | "TELEGRAM_AUCTION_HIGHLIGHT_SEND"
  | "FUEL_PRICE_REPORT_REJECT"
  | "FUEL_SCRAPER_RUN"
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

const ADMIN_AUDIT_VALUE_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: "активно",
  RESTRICTED: "ограничено",
  BANNED: "заблокировано",
  USER: "пользователь",
  VERIFIED_USER: "подтверждённый пользователь",
  PARTNER: "партнёр",
  MODERATOR: "модератор",
  ADMIN: "администратор",
  DRAFT: "черновик",
  PENDING: "ожидает проверки",
  PENDING_MODERATION: "на модерации",
  VERIFIED: "проверено",
  REJECTED: "отклонено",
  SUSPENDED: "приостановлено",
  ARCHIVED: "в архиве",
  OPEN: "открыто",
  IN_REVIEW: "на рассмотрении",
  RESOLVED: "решено",
  DISMISSED: "отклонено",
  NEW: "новая",
  CONTACTED: "связались с клиентом",
  IN_PROGRESS: "в работе",
  CLOSED: "закрыта",
  SOLD: "сделка завершена",
  TAKE_OVER: "оператор принял обращение",
  RELEASE_TO_AI: "обращение передано помощнику",
  CLOSE: "обращение закрыто",
  REOPEN: "обращение открыто повторно",
  SET_PRIORITY: "изменён приоритет",
  UPDATE_SUBJECT: "изменена тема",
}

/** Человекочитаемое русское название технического значения для журнала. */
export function adminAuditValueLabel(value: string) {
  return ADMIN_AUDIT_VALUE_LABELS[value] || value
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
