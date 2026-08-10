import { prisma } from "@/lib/prisma"
import { can, isAdmin } from "@/lib/permissions"

type SessionLike = { user?: { id?: string; role?: string } } | null

export const deliveryOrderInclude = {
  buyer: { select: { id: true, name: true, image: true } },
  partner: { select: { id: true, name: true, image: true } },
  manager: { select: { id: true, name: true, image: true } },
  auctionListing: { select: { id: true, make: true, model: true, year: true, country: true, lotNumber: true } },
  events: {
    orderBy: { completedAt: "asc" as const },
    include: { author: { select: { id: true, name: true, image: true } } },
  },
  payments: { orderBy: { createdAt: "asc" as const } },
  documents: {
    orderBy: { createdAt: "desc" as const },
    include: { uploadedBy: { select: { id: true, name: true } } },
  },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: { sender: { select: { id: true, name: true, image: true } } },
  },
}

export async function getDeliveryOrder(id: string) {
  return prisma.deliveryOrder.findUnique({ where: { id }, include: deliveryOrderInclude })
}

export function isDeliveryAdmin(session: SessionLike) {
  return isAdmin(session?.user?.role)
}

export function canReadDeliveryOrder(session: SessionLike, order: { buyerId: string; partnerId: string | null; managerId: string | null }) {
  const userId = session?.user?.id
  return Boolean(userId && (isDeliveryAdmin(session) || order.buyerId === userId || order.partnerId === userId || order.managerId === userId))
}

export function canManageDeliveryOrder(session: SessionLike, order: { partnerId: string | null; managerId: string | null }) {
  const userId = session?.user?.id
  return Boolean(
    userId && (
      can(session?.user?.role, "delivery:manage:any") ||
      (can(session?.user?.role, "delivery:manage:assigned") && (order.partnerId === userId || order.managerId === userId))
    ),
  )
}

export function deliveryOrderPermissions(session: SessionLike, order: { buyerId: string; partnerId: string | null; managerId: string | null }) {
  return {
    currentUserId: session?.user?.id || null,
    canRead: canReadDeliveryOrder(session, order),
    canManage: canManageDeliveryOrder(session, order),
    isBuyer: session?.user?.id === order.buyerId,
    isAdmin: isDeliveryAdmin(session),
  }
}

export function parseDeliveryDate(value: unknown) {
  if (!value || typeof value !== "string") return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function asTrimmedString(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}
