import { randomUUID } from "crypto"
import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { asTrimmedString, canManageDeliveryOrder, canReadDeliveryOrder } from "@/lib/delivery-access"
import { canTransitionDeliveryPayment } from "@/lib/delivery"
import { hasExpectedFileSignature } from "@/lib/file-signature"

export const dynamic = "force-dynamic"

const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024
const acceptedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"])
const buyerDocumentCategories = new Set(["RECEIPT", "BUYER_DOCUMENT", "OTHER"])
const allDocumentCategories = new Set(["INVOICE", "RECEIPT", "EXPORT", "CUSTOMS", "LABORATORY", "EPTS", "CONTRACT", "BUYER_DOCUMENT", "OTHER"])
const PAYMENT_STATE_CONFLICT = "DELIVERY_PAYMENT_STATE_CONFLICT"

function privateDocumentsDirectory() {
  return process.env.DELIVERY_DOCUMENTS_PATH || path.join(process.cwd(), "data", "delivery-documents")
}

/** POST /api/delivery-orders/[id]/documents — загрузка закрытого файла сделки. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const order = await prisma.deliveryOrder.findUnique({
      where: { id },
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
    const fileBytes = Buffer.from(await file.arrayBuffer())
    if (!hasExpectedFileSignature(file.type, fileBytes)) {
      return NextResponse.json({ error: "Содержимое файла не соответствует заявленному формату" }, { status: 400 })
    }
    if (!allDocumentCategories.has(category) || (!canManage && !buyerDocumentCategories.has(category))) {
      return NextResponse.json({ error: "Недопустимый тип документа" }, { status: 400 })
    }

    let relatedPayment: { id: string; status: string } | null = null
    if (paymentId) {
      if (category !== "RECEIPT") {
        return NextResponse.json({ error: "К счёту можно приложить только квитанцию" }, { status: 400 })
      }
      relatedPayment = await prisma.deliveryPayment.findFirst({ where: { id: paymentId, deliveryOrderId: order.id }, select: { id: true, status: true } })
      if (!relatedPayment) return NextResponse.json({ error: "Счёт не относится к этой сделке" }, { status: 400 })
      if (!canTransitionDeliveryPayment(relatedPayment.status, "AWAITING_CONFIRMATION")) {
        return NextResponse.json({ error: "Квитанцию можно приложить только к выставленному или просроченному счёту" }, { status: 409 })
      }
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
    await writeFile(target, fileBytes)

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
          const paymentUpdated = await tx.deliveryPayment.updateMany({
            where: { id: relatedPayment.id, status: relatedPayment.status },
            data: { receiptDocumentId: created.id, status: "AWAITING_CONFIRMATION", paidAt: new Date() },
          })
          if (paymentUpdated.count === 0) throw new Error(PAYMENT_STATE_CONFLICT)
        }
        return created
      })
      return NextResponse.json({ document: { ...document, downloadUrl: `/api/delivery-orders/${order.id}/documents/${document.id}` } }, { status: 201 })
    } catch (error) {
      await unlink(target).catch(() => undefined)
      if (error instanceof Error && error.message === PAYMENT_STATE_CONFLICT) {
        return NextResponse.json({ error: "Статус счёта уже изменился. Обновите страницу." }, { status: 409 })
      }
      throw error
    }
  } catch (error) {
    console.error("Delivery document POST error:", error)
    return NextResponse.json({ error: "Не удалось сохранить документ" }, { status: 500 })
  }
}
