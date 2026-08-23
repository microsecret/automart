import { readFile } from "fs/promises"
import path from "path"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isSafeMessageAttachmentStorageKey, messageAttachmentsDirectory } from "@/lib/message-attachments"

export const dynamic = "force-dynamic"

/** Закрытая выдача фотографии только участникам её диалога. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ conversationId: string; attachmentId: string }> }) {
  try {
    const { conversationId, attachmentId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: "Необходимо войти в аккаунт" }, { status: 401 })

    const attachment = await prisma.messageAttachment.findFirst({
      where: { id: attachmentId, message: { conversationId } },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        storageKey: true,
        message: { select: { senderId: true, receiverId: true } },
      },
    })
    if (!attachment) return NextResponse.json({ error: "Вложение не найдено" }, { status: 404 })
    if (![attachment.message.senderId, attachment.message.receiverId].includes(session.user.id)) {
      return NextResponse.json({ error: "Нет доступа к вложению" }, { status: 403 })
    }
    if (!isSafeMessageAttachmentStorageKey(attachment.storageKey)) {
      console.error("Rejected invalid message attachment storage key", { attachmentId: attachment.id })
      return NextResponse.json({ error: "Вложение повреждено" }, { status: 500 })
    }

    const file = await readFile(path.join(messageAttachmentsDirectory(), attachment.storageKey))
    const filename = encodeURIComponent(attachment.fileName.replace(/[\\/:*?"<>|]/g, "_"))
    return new NextResponse(file, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(file.byteLength),
        "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "Файл не найден в защищённом хранилище" }, { status: 404 })
    }
    console.error("Message attachment GET error:", error)
    return NextResponse.json({ error: "Не удалось открыть вложение" }, { status: 500 })
  }
}
