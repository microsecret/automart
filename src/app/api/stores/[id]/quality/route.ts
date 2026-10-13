import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin } from "@/lib/permissions"
import { storeCatalogQuality } from "@/lib/store-catalog-quality"

export const dynamic = "force-dynamic"

/** Качество каталога: владельцу и администратору. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Требуется вход" }, { status: 401 })
  const store = await prisma.partStore.findUnique({ where: { id }, select: { id: true, ownerId: true } })
  if (!store) return NextResponse.json({ error: "Магазин не найден" }, { status: 404 })
  if (store.ownerId !== session.user.id && !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Нет доступа к этому магазину" }, { status: 403 })
  }
  return NextResponse.json(await storeCatalogQuality(store.id))
}
