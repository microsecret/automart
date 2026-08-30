import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"
import { getServerSession } from "next-auth"
import sharp from "sharp"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyNewMessage } from "@/lib/message-notify"
import { createConversationId, normalizeMessageContent } from "@/lib/messages"
import { getClientIp, rateLimit, rateLimitHeaders } from "@/lib/rate-limit"
import { hasExpectedFileSignature } from "@/lib/file-signature"
import {
  MAX_MESSAGE_ATTACHMENTS,
  MAX_MESSAGE_ATTACHMENT_BYTES,
  MAX_MESSAGE_MULTIPART_BYTES,
  MESSAGE_ATTACHMENT_MIME_TYPES,
  messageAttachmentDownloadUrl,
  messageAttachmentsDirectory,
} from "@/lib/message-attachments"

const MESSAGE_PAGE_SIZE = 20

type IncomingMessagePayload = {
  content: unknown
  receiverId: unknown
  listingId: unknown
  files: File[]
}

async function readIncomingMessage(request: NextRequest): Promise<IncomingMessagePayload | null> {
  const contentType = request.headers.get("content-type") || ""
  if (contentType.toLowerCase().startsWith("multipart/form-data")) {
    const declaredLength = Number(request.headers.get("content-length"))
    if (Number.isFinite(declaredLength) && declaredLength > MAX_MESSAGE_MULTIPART_BYTES) return null
    const formData = await request.formData().catch(() => null)
    if (!formData) return null
    return {
      content: formData.get("content"),
      receiverId: formData.get("receiverId"),
      listingId: formData.get("listingId"),
      files: formData.getAll("files").filter((value): value is File => value instanceof File),
    }
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object" || Array.isArray(body)) return null
  const record = body as Record<string, unknown>
  return { content: record.content, receiverId: record.receiverId, listingId: record.listingId, files: [] }
}

function privateAttachmentFileName(originalName: string) {
  const base = originalName.replace(/\.[^.]+$/, "").replace(/[\u0000-\u001f\\/:*?"<>|]/g, "_").trim() || "Фотография"
  return `${base.slice(0, 140)}.jpg`
}
// GET all conversations for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Необходимо войти в аккаунт" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Handle special case for unread count only
    if (searchParams.get("unreadCountOnly") === "true") {
      const unreadCount = await prisma.message.count({
        where: {
          receiverId: session.user.id,
          senderId: { not: session.user.id },
          isRead: false,
        }
      })

      return NextResponse.json({ count: unreadCount })
    }

    /* Верхняя граница страницы обязательна.

       Без неё `?page=999999999` превращается в skip на десять миллиардов, и
       база обязана перебрать и отбросить все строки, прежде чем вернуть
       пустой список. Соседние маршруты — уведомления, избранное, отзывы —
       эту границу уже ставят; здесь её забыли. */
    const page = Math.min(10_000, Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1))
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") || String(MESSAGE_PAGE_SIZE), 10) || MESSAGE_PAGE_SIZE))
    const skip = (page - 1) * limit
    const participantWhere = {
      OR: [
        { senderId: session.user.id },
        { receiverId: session.user.id },
      ],
    }

    // Get conversations where the current user is either sender or receiver
    // Now we can efficiently query by conversationId
    const [conversations, conversationCount] = await Promise.all([
      prisma.message.groupBy({
        by: ['conversationId'],
        where: participantWhere,
        _count: { id: true },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: 'desc' } },
        skip,
        take: limit,
      }),
      /* Число диалогов считается запросом, а не выгрузкой.

         Здесь стоял второй groupBy без ограничения: он вытягивал по
         строке на каждый диалог, в котором человек когда-либо
         участвовал, — и всё это ради одного числа в пагинации. У
         активного продавца с тысячами переписок ящик открывался тем
         медленнее, чем дольше он пользуется сервисом, а этот же
         запрос дёргается для значка непрочитанных.

         COUNT(DISTINCT) считает то же самое на стороне базы и
         возвращает одну строку. */
      prisma.$queryRaw<Array<{ count: number | bigint }>>`
        SELECT COUNT(DISTINCT "conversationId") AS count
        FROM "Message"
        WHERE "senderId" = ${session.user.id} OR "receiverId" = ${session.user.id}
      `,
    ])

    /* COUNT возвращает число в SQLite и BigInt в PostgreSQL: BigInt
       не сериализуется в JSON, и ответ упал бы на выдаче. Number
       снимает разницу и не мешает переезду на другую базу. */
    const totalConversations = Number(conversationCount[0]?.count ?? 0)

    // Fetch all details in batches instead of making three additional queries
    // per conversation. The compound index on (conversationId, createdAt)
    // keeps this predictable as the mailbox grows.
    const latestMessageFilters = conversations.flatMap((conversation) => (
      conversation._max.createdAt
        ? [{ conversationId: conversation.conversationId, createdAt: conversation._max.createdAt }]
        : []
    ))
    const conversationIds = conversations.map((conversation) => conversation.conversationId)
    const [latestCandidates, unreadGroups] = await Promise.all([
      latestMessageFilters.length > 0
        ? prisma.message.findMany({
            where: { AND: [participantWhere, { OR: latestMessageFilters }] },
            orderBy: { createdAt: "desc" },
            include: {
              listing: {
                select: {
                  id: true,
                  title: true,
                  vehicle: { select: { year: true, make: true, model: true } },
                  part: { select: { name: true, make: true, model: true } },
                },
              },
              _count: { select: { attachments: true } },
            },
          })
        : Promise.resolve([]),
      conversationIds.length > 0
        ? prisma.message.groupBy({
            by: ["conversationId"],
            where: {
              conversationId: { in: conversationIds },
              senderId: { not: session.user.id },
              receiverId: session.user.id,
              isRead: false,
            },
            _count: { id: true },
          })
        : Promise.resolve([]),
    ])

    // Timestamps are expected to be unique enough for the groupBy query; the
    // map also makes a rare tie deterministic without exposing duplicate rows.
    const latestByConversation = new Map<string, typeof latestCandidates[number]>()
    for (const message of latestCandidates) {
      if (!latestByConversation.has(message.conversationId)) latestByConversation.set(message.conversationId, message)
    }
    const unreadByConversation = new Map(unreadGroups.map((group) => [group.conversationId, group._count.id]))
    const otherUserIds = [...new Set(
      [...latestByConversation.values()]
        .map((message) => message.senderId === session.user.id ? message.receiverId : message.senderId)
        .filter(Boolean),
    )]
    const otherUsers = otherUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: otherUserIds } },
          select: { id: true, name: true, image: true },
        })
      : []
    const otherUserById = new Map(otherUsers.map((user) => [user.id, user]))

    const conversationDetails = conversations.map((conversation) => {
      const latestMessage = latestByConversation.get(conversation.conversationId)
      const otherUserId = latestMessage
        ? latestMessage.senderId === session.user.id
          ? latestMessage.receiverId
          : latestMessage.senderId
        : undefined
      const otherUser = otherUserId ? otherUserById.get(otherUserId) : null

      return {
        id: conversation.conversationId,
        otherUser: otherUser ?? {
          id: otherUserId ?? "",
          name: "Пользователь",
          image: null,
        },
        listing: latestMessage?.listing ? {
          id: latestMessage.listing.id,
          title: latestMessage.listing.title,
          vehicle: latestMessage.listing.vehicle,
          part: latestMessage.listing.part,
        } : null,
        lastMessage: latestMessage ? {
          id: latestMessage.id,
          content: latestMessage.content,
          isRead: latestMessage.isRead,
          createdAt: latestMessage.createdAt,
          senderId: latestMessage.senderId,
          attachmentCount: latestMessage._count.attachments,
        } : null,
        unreadCount: unreadByConversation.get(conversation.conversationId) || 0,
      }
    })

    return NextResponse.json({
      conversations: conversationDetails,
      pagination: {
        page,
        limit,
        total: totalConversations,
        pages: Math.ceil(totalConversations / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching conversations:", error)
    return NextResponse.json(
      { error: "Не удалось загрузить диалоги" },
      { status: 500 }
    )
  }
}

// POST send a new message
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: "Необходимо войти в аккаунт" },
        { status: 401 }
      )
    }

    const userLimit = rateLimit(`messages:user:${session.user.id}`, { windowMs: 60_000, maxRequests: 30 })
    const ipLimit = rateLimit(`messages:ip:${getClientIp(request)}`, { windowMs: 60_000, maxRequests: 60 })
    if (!userLimit.success || !ipLimit.success) {
      const limit = !userLimit.success ? userLimit : ipLimit
      return NextResponse.json({ error: "Слишком много сообщений. Подождите минуту." }, { status: 429, headers: rateLimitHeaders(limit) })
    }

    if ((request.headers.get("content-type") || "").toLowerCase().startsWith("multipart/form-data")) {
      const attachmentUserLimit = rateLimit(`message-attachments:user:${session.user.id}`, { windowMs: 60 * 60_000, maxRequests: 12 })
      const attachmentIpLimit = rateLimit(`message-attachments:ip:${getClientIp(request)}`, { windowMs: 60 * 60_000, maxRequests: 40 })
      if (!attachmentUserLimit.success || !attachmentIpLimit.success) {
        const limit = !attachmentUserLimit.success ? attachmentUserLimit : attachmentIpLimit
        return NextResponse.json({ error: "Слишком много загрузок фотографий. Попробуйте позже." }, { status: 429, headers: rateLimitHeaders(limit) })
      }
    }

    const body = await readIncomingMessage(request)
    if (!body) return NextResponse.json({ error: "Некорректные данные сообщения или превышен размер запроса" }, { status: 400 })
    const { content, receiverId, listingId, files } = body
    if (files.length > MAX_MESSAGE_ATTACHMENTS) {
      return NextResponse.json({ error: `К сообщению можно приложить не более ${MAX_MESSAGE_ATTACHMENTS} фотографий` }, { status: 400 })
    }

    const trimmedContent = typeof content === "string" ? content.trim() : ""
    const normalizedContent = trimmedContent ? normalizeMessageContent(trimmedContent) : null
    if (trimmedContent && !normalizedContent) {
      return NextResponse.json({ error: "Сообщение должно содержать не более 4000 символов" }, { status: 400 })
    }
    if (!normalizedContent && files.length === 0) {
      return NextResponse.json({ error: "Добавьте текст или фотографию" }, { status: 400 })
    }

    if (typeof receiverId !== "string" || !receiverId) return NextResponse.json({ error: "Укажите получателя" }, { status: 400 })
    if (receiverId === session.user.id) return NextResponse.json({ error: "Нельзя написать самому себе" }, { status: 400 })

    // Verify receiver exists
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { id: true }
    })

    if (!receiver) {
      return NextResponse.json(
        { error: "Получатель не найден" },
        { status: 404 }
      )
    }

    const normalizedRequestedListingId = typeof listingId === "string" ? listingId : null
    const conversationId = createConversationId(session.user.id, receiverId, normalizedRequestedListingId)

    // New contacts are only allowed through a public card and its real owner.
    // A buyer and seller who have already begun a dialogue can still settle
    // details after the card is archived or sold.
    let normalizedListingId: string | null = null
    if (listingId !== undefined && listingId !== null) {
      if (typeof listingId !== "string" || !listingId) return NextResponse.json({ error: "Некорректное объявление" }, { status: 400 })
      const listing = await prisma.listing.findUnique({
        where: { id: listingId },
        select: { id: true, userId: true, status: true, deletedAt: true }
      })

      const isPublicSellerContact = Boolean(listing && !listing.deletedAt && listing.status === "ACTIVE" && listing.userId === receiverId)
      if (!isPublicSellerContact) {
        const existingDialogue = await prisma.message.findFirst({
          where: {
            conversationId,
            listingId,
            OR: [
              { senderId: session.user.id, receiverId },
              { senderId: receiverId, receiverId: session.user.id },
            ],
          },
          select: { id: true },
        })
        if (!existingDialogue) return NextResponse.json({ error: "Объявление недоступно для новых сообщений" }, { status: 404 })
      }
      normalizedListingId = listingId
    } else {
      // New contact must originate from a public listing. This keeps the
      // endpoint from becoming a way to message arbitrary user accounts.
      const existingDialogue = await prisma.message.findFirst({
        where: {
          conversationId,
          listingId: null,
          OR: [
            { senderId: session.user.id, receiverId },
            { senderId: receiverId, receiverId: session.user.id },
          ],
        },
        select: { id: true },
      })
      if (!existingDialogue) {
        return NextResponse.json({ error: "Новый диалог можно начать только из карточки объявления" }, { status: 400 })
      }
    }

    const preparedAttachments = [] as Array<{ storageKey: string; fileName: string; bytes: Buffer }>
    for (const file of files) {
      if (!MESSAGE_ATTACHMENT_MIME_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_MESSAGE_ATTACHMENT_BYTES) {
        return NextResponse.json({ error: "Разрешены JPG, PNG и WebP до 8 МБ; не более четырёх фотографий" }, { status: 400 })
      }
      const bytes = Buffer.from(await file.arrayBuffer())
      if (!hasExpectedFileSignature(file.type, bytes)) {
        return NextResponse.json({ error: "Содержимое фотографии не соответствует заявленному формату" }, { status: 400 })
      }
      const optimized = await sharp(bytes)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toBuffer()
        .catch(() => null)
      if (!optimized) return NextResponse.json({ error: "Не удалось обработать фотографию" }, { status: 400 })
      preparedAttachments.push({ storageKey: `${randomUUID()}.jpg`, fileName: privateAttachmentFileName(file.name), bytes: optimized })
    }

    const storedPaths: string[] = []
    let message
    try {
      if (preparedAttachments.length) await mkdir(messageAttachmentsDirectory(), { recursive: true })
      for (const attachment of preparedAttachments) {
        const target = path.join(messageAttachmentsDirectory(), attachment.storageKey)
        await writeFile(target, attachment.bytes, { flag: "wx" })
        storedPaths.push(target)
      }

      message = await prisma.message.create({
        data: {
          content: normalizedContent || "",
          senderId: session.user.id,
          receiverId,
          listingId: normalizedListingId,
          conversationId,
          attachments: {
            create: preparedAttachments.map((attachment) => ({
              fileName: attachment.fileName,
              mimeType: "image/jpeg",
              size: attachment.bytes.byteLength,
              storageKey: attachment.storageKey,
              uploadedById: session.user.id,
            })),
          },
        },
        include: {
          sender: { select: { id: true, name: true, image: true } },
          receiver: { select: { id: true, name: true, image: true } },
          listing: { select: { id: true, title: true } },
          attachments: { select: { id: true, fileName: true, mimeType: true, size: true } },
        },
      })
    } catch (error) {
      await Promise.all(storedPaths.map((target) => unlink(target).catch(() => undefined)))
      throw error
    }

    /* Уведомление уходит в Telegram, не задерживая ответ.

       Продавец не сидит на сайте: он выставил машину и ждёт. Покупатель
       пишет, а ответа нет неделю — сделка уходит к тому, кто ответил за час.

       `void` намеренно: отправитель не должен ждать, пока Telegram примет
       сообщение, а сбой доставки не повод считать письмо неотправленным. */
    void notifyNewMessage(message.id)

    return NextResponse.json({
      ...message,
      attachments: message.attachments.map((attachment) => ({
        ...attachment,
        downloadUrl: messageAttachmentDownloadUrl(message.conversationId, attachment.id),
      })),
    }, { status: 201 })
  } catch (error) {
    console.error("Error sending message:", error)
    return NextResponse.json(
      { error: "Не удалось отправить сообщение" },
      { status: 500 }
    )
  }
}
