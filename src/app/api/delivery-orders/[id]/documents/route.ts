import { randomUUID } from "crypto"
import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { asTrimmedString, canManageDeliveryOrder, canReadDeliveryOrder } from "@/lib/delivery-access"

export const dynamic = "force-dynamic"

const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024
const acceptedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"])
const buyerDocumentCategories = new Set(["RECEIPT", "BUYER_DOCUMENT", "OTHER"])
const allDocumentCategories = new Set(["INVOICE", "RECEIPT", "EXPORT", "CUSTOMS", "LABORATORY", "EPTS", "CONTRACT", "BUYER_DOCUMENT", "OTHER"])

function privateDocumentsDirectory() {
  return process.env.DELIVERY_DOCUMENTS_PATH || path.join(process.cwd(), "data", "delivery-documents")
}

/** POST /api/delivery-orders/[id]/documents — загрузка закрытого файла сделки. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const order = await prisma.deliveryOrder.findUnique({
      where: { id: params.id },
      select: { id: true, buyerId: true, partnerId: true, managerId: true },
    })
    if (!order) return NextResponse.json({ error: "Сделка не найдена" }, { status: 404 })
    if (!canReadDeliveryOrder(session, order)) return NextResponse.json({ error: "Нет доступа к документам" }, { status: 403 })

    const formData = await request.formData()
    const file = formData.get("file")
    const category = asTrimmedString(formData.get("category"), 30) || "OTHER"
    const title = asTrimmedString(formData.get("title"), 160)
    const paymentId = asTrimmedString(formData.get("paymentId"), 80) || null
    const canManage = canManageDeliveryOrder(session, order)

    if (!(file instanceof File) || !acceptedMimeTypes.has(file.type) || file.size <= 0 || file.size > MAX_DOCUMENT_SIZE) {
      return NextResponse.json({ error: "Разрешены PDF, JPG, PNG и WebP до 20 МБ" }, { status: 400 })
    }
    if (!allDocumentCategories.has(category) || (!canManage && !buyerDocumentCategories.has(category))) {
      return NextResponse.json({ error: "Недопустимый тип документа" }, { status: 400 })
    }

    let relatedPayment: { id: string } | null = null
    if (paymentId) {
      relatedPayment = await prisma.deliveryPayment.findFirst({ where: { id: paymentId, deliveryOrderId: order.id }, select: { id: true } })
      if (!relatedPayment) return NextResponse.json({ error: "Счёт не относится к этой сделке" }, { status: 400 })
    }

    const extensionByMime: Record<string, string> = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }
    const storageKey = `${randomUUID()}.${extensionByMime[file.type]}`
    const directory = privateDocumentsDirectory()
    await mkdir(directory, { recursive: true })
    const target = path.join(directory, storageKey)
    await writeFile(target, Buffer.from(await file.arrayBuffer()))

    try {
      const document = await prisma.$transaction(async (tx) => {
        const created = await tx.deliveryDocument.create({
          data: {
            deliveryOrderId: order.id,
            title: title || file.name.slice(0, 160),
            category,
            visibility: canManage && formData.get("visibility") === "TEAM_ONLY" ? "TEAM_ONLY" : "BUYER_AND_TEAM",
            fileName: file.name.slice(0, 180),
            mimeType: file.type,
            size: file.size,
            storageKey,
            uploadedById: session.user.id,
          },
        })
        if (relatedPayment) {
          await tx.deliveryPayment.update({
            where: { id: relatedPayment.id },
            data: { receiptDocumentId: created.id, status: "AWAITING_CONFIRMATION", paidAt: new Date() },
          })
        }
        return created
      })
      return NextResponse.json({ document: { ...document, downloadUrl: `/api/delivery-orders/${order.id}/documents/${document.id}` } }, { status: 201 })
    } catch (error) {
      await unlink(target).catch(() => undefined)
      throw error
    }
  } catch (error) {
    console.error("Delivery document POST error:", error)
    return NextResponse.json({ error: "Не удалось сохранить документ" }, { status: 500 })
  }
}
