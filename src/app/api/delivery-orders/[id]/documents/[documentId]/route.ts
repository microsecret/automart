import { readFile } from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageDeliveryOrder, canReadDeliveryOrder } from "@/lib/delivery-access"

export const dynamic = "force-dynamic"

function privateDocumentsDirectory() {
  return process.env.DELIVERY_DOCUMENTS_PATH || path.join(process.cwd(), "data", "delivery-documents")
}

function isSafeStorageKey(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:pdf|jpg|png|webp)$/i.test(value)
}

/** GET /api/delivery-orders/[id]/documents/[documentId] — закрытая отдача файла. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  try {
    const { id, documentId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const order = await prisma.deliveryOrder.findUnique({
      where: { id },
      select: { id: true, buyerId: true, partnerId: true, managerId: true },
    })
    if (!order) return NextResponse.json({ error: "Сделка не найдена" }, { status: 404 })
    if (!canReadDeliveryOrder(session, order)) return NextResponse.json({ error: "Нет доступа к документу" }, { status: 403 })

    const document = await prisma.deliveryDocument.findFirst({ where: { id: documentId, deliveryOrderId: order.id } })
    if (!document) return NextResponse.json({ error: "Документ не найден" }, { status: 404 })
    if (document.visibility === "TEAM_ONLY" && !canManageDeliveryOrder(session, order)) {
      return NextResponse.json({ error: "Нет доступа к служебному документу" }, { status: 403 })
    }
    if (!isSafeStorageKey(document.storageKey)) {
      console.error("Rejected invalid delivery document storage key", { documentId: document.id })
      return NextResponse.json({ error: "Документ повреждён" }, { status: 500 })
    }

    const file = await readFile(path.join(privateDocumentsDirectory(), document.storageKey))
    const filename = encodeURIComponent(document.fileName.replace(/[\\/:*?"<>|]/g, "_"))
    return new NextResponse(file, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(file.byteLength),
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Файл не найден в защищённом хранилище" }, { status: 404 })
    }
    console.error("Delivery document GET error:", error)
    return NextResponse.json({ error: "Не удалось открыть документ" }, { status: 500 })
  }
}
