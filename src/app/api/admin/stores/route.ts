import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin-route-guard"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const ALLOWED_STATUSES = new Set(["DRAFT", "PENDING", "ACTIVE", "SUSPENDED"])

/** Реестр магазинов для проверки: доступен только администратору. */
export async function GET(request: NextRequest) {
  const guard = await requireAdminSession()
  if (guard.denied) return guard.denied

  const status = request.nextUrl.searchParams.get("status") || "PENDING"
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "Некорректный статус" }, { status: 400 })
  }

  const stores = await prisma.partStore.findMany({
    where: { status },
    // Заявки разбираются в порядке поступления: первым проверяется тот, кто
    // ждёт дольше.
    orderBy: status === "PENDING" ? { updatedAt: "asc" } : { updatedAt: "desc" },
    take: 50,
    select: {
      id: true, name: true, slug: true, city: true, legalName: true, inn: true,
      contactPhone: true, contactEmail: true, status: true, statusReason: true, createdAt: true,
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { parts: true } },
    },
  })

  return NextResponse.json({ stores })
}
