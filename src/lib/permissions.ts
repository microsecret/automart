/**
 * Server-side authorization vocabulary.
 *
 * SQLite stores roles as strings, so every database/session value is
 * normalized before policy evaluation. New routes must call `can` instead of
 * comparing role strings directly.
 */
export const USER_ROLE = {
  USER: "USER",
  VERIFIED_USER: "VERIFIED_USER",
  PARTNER: "PARTNER",
  MODERATOR: "MODERATOR",
  ADMIN: "ADMIN",
} as const

export type UserRole = typeof USER_ROLE[keyof typeof USER_ROLE]

const roleValues = new Set<string>(Object.values(USER_ROLE))

export function normalizeUserRole(value: unknown): UserRole {
  return typeof value === "string" && roleValues.has(value)
    ? value as UserRole
    : USER_ROLE.USER
}

export function isAdmin(role: unknown) {
  return normalizeUserRole(role) === USER_ROLE.ADMIN
}

export function isModerator(role: unknown) {
  const normalizedRole = normalizeUserRole(role)
  return normalizedRole === USER_ROLE.ADMIN || normalizedRole === USER_ROLE.MODERATOR
}

export type Permission =
  | "admin:access"
  | "auction:manage"
  | "listing:moderate"
  | "listing:remove:any"
  | "delivery:manage:any"
  | "delivery:manage:assigned"
  | "delivery:document:team"
  | "support:manage"

const permissions: Record<Permission, readonly UserRole[]> = {
  "admin:access": [USER_ROLE.ADMIN],
  "auction:manage": [USER_ROLE.ADMIN],
  "listing:moderate": [USER_ROLE.MODERATOR, USER_ROLE.ADMIN],
  "listing:remove:any": [USER_ROLE.MODERATOR, USER_ROLE.ADMIN],
  "delivery:manage:any": [USER_ROLE.ADMIN],
  "delivery:manage:assigned": [USER_ROLE.PARTNER, USER_ROLE.MODERATOR, USER_ROLE.ADMIN],
  "delivery:document:team": [USER_ROLE.PARTNER, USER_ROLE.MODERATOR, USER_ROLE.ADMIN],
  "support:manage": [USER_ROLE.ADMIN],
}

export function can(role: unknown, permission: Permission) {
  return permissions[permission].includes(normalizeUserRole(role))
}

type DeliveryOwnership = {
  buyerId: string
  partnerId: string | null
  managerId: string | null
}

/**
 * Reading a protected deal is an authorization decision, not just an ownership
 * lookup. A suspended partner keeps the historical partnerId on the order for
 * audit purposes, but loses the PARTNER permission and therefore loses access.
 */
export function canReadAssignedDelivery(role: unknown, userId: string | null | undefined, order: DeliveryOwnership) {
  if (!userId) return false
  if (can(role, "delivery:manage:any")) return true
  if (order.buyerId === userId) return true
  return can(role, "delivery:manage:assigned") && (order.partnerId === userId || order.managerId === userId)
}
