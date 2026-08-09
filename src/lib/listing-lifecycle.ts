/**
 * Единый справочник жизненного цикла объявлений.
 *
 * Значения хранятся строками, чтобы миграция оставалась совместимой с SQLite,
 * но все входящие переходы проходят через этот модуль, а не через произвольные
 * значения из клиента.
 */
export const LISTING_STATUS = {
  DRAFT: "DRAFT",
  PENDING_MODERATION: "PENDING_MODERATION",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  REJECTED: "REJECTED",
  SOLD: "SOLD",
  ARCHIVED: "ARCHIVED",
} as const

export type ListingStatus = typeof LISTING_STATUS[keyof typeof LISTING_STATUS]

export const LISTING_STATUS_META: Record<ListingStatus, { label: string; color: string }> = {
  [LISTING_STATUS.DRAFT]: { label: "Черновик", color: "gray" },
  [LISTING_STATUS.PENDING_MODERATION]: { label: "На проверке", color: "yellow" },
  [LISTING_STATUS.ACTIVE]: { label: "Активно", color: "green" },
  [LISTING_STATUS.PAUSED]: { label: "Приостановлено", color: "blue" },
  [LISTING_STATUS.REJECTED]: { label: "Нужна доработка", color: "red" },
  [LISTING_STATUS.SOLD]: { label: "Продано", color: "violet" },
  [LISTING_STATUS.ARCHIVED]: { label: "В архиве", color: "gray" },
}

const statusValues = new Set<string>(Object.values(LISTING_STATUS))

export function isListingStatus(value: unknown): value is ListingStatus {
  return typeof value === "string" && statusValues.has(value)
}

export function isListingModerator(role?: string | null) {
  return isModerator(role)
}

export function getOwnerTransition(status: ListingStatus, action: unknown): ListingStatus | null {
  switch (action) {
    case "SUBMIT_FOR_MODERATION":
      return status === LISTING_STATUS.DRAFT || status === LISTING_STATUS.REJECTED || status === LISTING_STATUS.ARCHIVED
        ? LISTING_STATUS.PENDING_MODERATION
        : null
    case "PAUSE":
      return status === LISTING_STATUS.ACTIVE ? LISTING_STATUS.PAUSED : null
    case "RESUME":
      return status === LISTING_STATUS.PAUSED ? LISTING_STATUS.ACTIVE : null
    case "MARK_SOLD":
      return status === LISTING_STATUS.ACTIVE || status === LISTING_STATUS.PAUSED ? LISTING_STATUS.SOLD : null
    case "ARCHIVE":
      return status !== LISTING_STATUS.ARCHIVED ? LISTING_STATUS.ARCHIVED : null
    default:
      return null
  }
}

export function canModeratorTransition(from: ListingStatus, to: ListingStatus) {
  if (from === to) return false
  if (to === LISTING_STATUS.ACTIVE) return from === LISTING_STATUS.PENDING_MODERATION || from === LISTING_STATUS.PAUSED
  if (to === LISTING_STATUS.REJECTED) return from === LISTING_STATUS.PENDING_MODERATION
  return to === LISTING_STATUS.ARCHIVED
}

export const publicListingWhere = {
  status: LISTING_STATUS.ACTIVE,
  deletedAt: null,
} as const
import { isModerator } from "@/lib/permissions"
