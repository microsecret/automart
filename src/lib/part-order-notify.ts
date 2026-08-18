import { prisma } from "@/lib/prisma"
import { getTelegramMiniAppUrl, telegramApi } from "@/lib/telegram"

// Заказ приходит в кабинет, но продавец туда не смотрит постоянно: без
// уведомления обращение может пролежать сутки, а покупатель за это время
// уйдёт в другой магазин. Поэтому владелец витрины получает и запись в
// уведомлениях, и сообщение в Telegram, если он его подтвердил.

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

type OrderNotification = {
  orderId: string
  storeId: string
  itemName: string
  quantity: number
  itemPriceRub: number
  contactName: string
  contactPhone: string
  city: string | null
  comment: string | null
}

/**
 * Сообщает владельцу магазина о новом заказе.
 *
 * Ошибка доставки не отменяет уже созданный заказ: покупатель своё действие
 * совершил, и терять его из-за недоступного Telegram нельзя.
 */
export async function notifyStoreOwnerAboutOrder(order: OrderNotification) {
  try {
    const store = await prisma.partStore.findUnique({
      where: { id: order.storeId },
      select: {
        name: true,
        owner: { select: { id: true, telegramId: true, telegramVerifiedAt: true } },
      },
    })
    if (!store?.owner) return

    const total = order.itemPriceRub * order.quantity
    const title = "Новый заказ в магазине"
    const content = [
      `${order.itemName} — ${order.quantity} шт на ${total.toLocaleString("ru-RU")} ₽`,
      `Покупатель: ${order.contactName}, ${order.contactPhone}`,
      order.city ? `Город: ${order.city}` : null,
    ].filter(Boolean).join("\n")

    await prisma.notification.create({
      data: {
        userId: store.owner.id,
        title,
        content,
        type: "INFO",
        relatedType: "PART_ORDER",
        relatedId: order.orderId,
      },
    })

    if (!store.owner.telegramId || !store.owner.telegramVerifiedAt) return

    const miniAppUrl = getTelegramMiniAppUrl()
    const lines = [
      `🛒 <b>Новый заказ · ${escapeHtml(store.name)}</b>`,
      "",
      `📦 ${escapeHtml(order.itemName)}`,
      `🔢 ${order.quantity} шт · <b>${total.toLocaleString("ru-RU")} ₽</b>`,
      "",
      `👤 ${escapeHtml(order.contactName)}`,
      `📞 ${escapeHtml(order.contactPhone)}`,
      order.city ? `📍 ${escapeHtml(order.city)}` : null,
      order.comment ? `💬 ${escapeHtml(order.comment.slice(0, 200))}` : null,
      "",
      "Свяжитесь с покупателем и подтвердите наличие и срок.",
    ].filter((line) => line !== null)

    await telegramApi("sendMessage", {
      chat_id: store.owner.telegramId,
      text: lines.join("\n"),
      parse_mode: "HTML",
      reply_markup: miniAppUrl
        ? { inline_keyboard: [[{ text: "Открыть заказы", web_app: { url: miniAppUrl } }]] }
        : undefined,
    })
  } catch (error) {
    // Доставка уведомления вторична по отношению к самому заказу.
    console.warn("Part order notification was not delivered", error instanceof Error ? error.message : error)
  }
}
