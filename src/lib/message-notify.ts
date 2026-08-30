import { prisma } from "@/lib/prisma"
import { getTelegramPageUrl, telegramApi } from "@/lib/telegram"
import { markTelegramContactBlocked } from "@/lib/telegram-contacts"

/**
 * Уведомление о новом сообщении по объявлению.
 *
 * Продавец не сидит на сайте: он выставил машину и ждёт. Покупатель пишет,
 * а ответа нет неделю — сделка уходит к тому, кто ответил за час. Telegram
 * у продавца открыт всегда, и переписка уже привязана к аккаунту, поэтому
 * уведомление доходит сразу.
 */

/** Ограничение Telegram на длину сообщения — берём с запасом. */
const MAX_PREVIEW = 160

/**
 * Пауза между уведомлениями в одном диалоге.
 *
 * Без неё оживлённая переписка превращается в шквал: десять сообщений подряд
 * дадут десять оповещений. Пять минут — достаточно, чтобы человек успел
 * открыть чат и увидеть всё разом.
 */
const NOTIFY_COOLDOWN_MS = 5 * 60 * 1000

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Сообщить получателю о новом письме.
 *
 * Уведомление не отправляется, если получатель недавно уже получил его по
 * этому диалогу или если он сам только что писал — значит переписка открыта
 * и человек в ней.
 *
 * Ошибки не пробрасываются: сообщение уже сохранено, и сбой доставки не
 * должен ломать отправку.
 */
export async function notifyNewMessage(messageId: string): Promise<void> {
  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        content: true,
        conversationId: true,
        createdAt: true,
        senderId: true,
        sender: { select: { name: true } },
        receiver: { select: { id: true, telegramId: true, telegramVerifiedAt: true } },
        listing: { select: { id: true, title: true } },
        _count: { select: { attachments: true } },
      },
    })

    if (!message?.receiver?.telegramId || !message.receiver.telegramVerifiedAt) return

    /* Получатель писал сам за последние пять минут — значит чат открыт.

       Уведомлять человека о письме, которое он видит прямо сейчас, — верный
       способ приучить его отключить оповещения. */
    const recentReply = await prisma.message.findFirst({
      where: {
        conversationId: message.conversationId,
        senderId: message.receiver.id,
        createdAt: { gte: new Date(Date.now() - NOTIFY_COOLDOWN_MS) },
      },
      select: { id: true },
    })
    if (recentReply) return

    // Предыдущее сообщение собеседника в этом же диалоге за время паузы:
    // о нём уже уведомили, второй раз незачем.
    const alreadyNotified = await prisma.message.findFirst({
      where: {
        conversationId: message.conversationId,
        senderId: message.senderId,
        id: { not: message.id },
        createdAt: { gte: new Date(Date.now() - NOTIFY_COOLDOWN_MS) },
      },
      select: { id: true },
    })
    if (alreadyNotified) return

    const rawPreview = message.content || (message._count.attachments > 0 ? `📷 Фото: ${message._count.attachments}` : "Новое сообщение")
    const preview = rawPreview.length > MAX_PREVIEW
      ? `${rawPreview.slice(0, MAX_PREVIEW)}…`
      : rawPreview

    /* Кнопка открывает сам разговор, а не ленту машин. Продавцу пишут
       по конкретному объявлению, и «Ответить», ведущее на главный
       экран, заставляло искать этот разговор заново — при том что
       уведомление ровно о нём. */
    const miniAppUrl = getTelegramPageUrl(`/messages/${message.conversationId}`)
    const lines = [
      `💬 <b>${escapeHtml(message.sender?.name || "Покупатель")} написал вам</b>`,
      message.listing?.title ? `📋 ${escapeHtml(message.listing.title)}` : null,
      "",
      escapeHtml(preview),
      "",
      "Быстрый ответ повышает шанс сделки: покупатель пишет сразу нескольким продавцам.",
    ].filter((line) => line !== null)

    await telegramApi("sendMessage", {
      chat_id: message.receiver.telegramId,
      text: lines.join("\n"),
      parse_mode: "HTML",
      reply_markup: miniAppUrl
        ? { inline_keyboard: [[{ text: "Ответить", web_app: { url: miniAppUrl } }]] }
        : undefined,
    })
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    // Человек заблокировал бота — отмечаем, чтобы не долбиться в закрытую дверь.
    if (/blocked|deactivated|chat not found/i.test(text)) {
      const receiver = await prisma.message
        .findUnique({ where: { id: messageId }, select: { receiver: { select: { telegramId: true } } } })
        .catch(() => null)
      if (receiver?.receiver?.telegramId) {
        await markTelegramContactBlocked(receiver.receiver.telegramId).catch(() => undefined)
      }
      return
    }
    // Доставка уведомления вторична: само сообщение уже сохранено.
    console.warn("Message notification was not delivered", text)
  }
}
