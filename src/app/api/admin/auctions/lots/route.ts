import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAdminSession } from "@/lib/admin-route-guard"
import { recordAdminAudit } from "@/lib/admin-audit"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied
  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 80) || ""
  const visibility = request.nextUrl.searchParams.get("visibility") === "hidden" ? "hidden" : "visible"
  const where = {
    adminHiddenAt: visibility === "hidden" ? { not: null } : null,
    ...(q ? { OR: [{ make: { contains: q } }, { model: { contains: q } }, { lotNumber: { contains: q } }, { sourceId: { contains: q } }] } : {}),
  }
  const lots = await prisma.auctionListing.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, make: true, model: true, year: true, source: true, lotNumber: true, status: true, finalPrice: true, imageUrl: true, adminHiddenAt: true, adminHiddenReason: true, updatedAt: true },
  })
  return NextResponse.json({ lots })
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied
  const session = guard.session
  const body = await request.json().catch(() => null)
  const id = typeof body?.id === "string" ? body.id : ""
  const action = body?.action === "RESTORE" ? "RESTORE" : body?.action === "HIDE" ? "HIDE" : null
  const reason = typeof body?.reason === "string" ? body.reason.trim().replace(/\s+/g, " ").slice(0, 500) : ""
  if (!id || !action) return NextResponse.json({ error: "Некорректное действие" }, { status: 400 })
  if (action === "HIDE" && reason.length < 3) return NextResponse.json({ error: "Укажите причину скрытия" }, { status: 400 })
  const existing = await prisma.auctionListing.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: "Лот не найден" }, { status: 404 })
  const lot = await prisma.auctionListing.update({
    where: { id },
    data: action === "HIDE" ? { adminHiddenAt: new Date(), adminHiddenReason: reason } : { adminHiddenAt: null, adminHiddenReason: null },
    select: { id: true, adminHiddenAt: true, adminHiddenReason: true },
  })
  await recordAdminAudit({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: action === "HIDE" ? "AUCTION_LOT_HIDE" : "AUCTION_LOT_RESTORE",
    entityType: "AuctionListing",
    entityId: id,
    summary: action === "HIDE" ? `Лот скрыт: ${reason}` : "Лот возвращён в публичный каталог",
    metadata: action === "HIDE" ? { reason } : null,
  })
  return NextResponse.json({ lot })
}
