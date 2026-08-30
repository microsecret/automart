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

// Покупатель оставил заявку и ждёт: без сообщения о смене статуса он не знает,
// подтвердил ли магазин наличие и когда ждать деталь. Уведомление приходит
// только зарегистрированному покупателю — у анонимного заказа нет адресата.

const BUYER_STATUS_MESSAGES: Readonly<Record<string, { title: string; text: (item: string, store: string) => string }>> = {
  CONFIRMED: {
    title: "Заказ подтверждён",
    text: (item, store) => `${store} подтвердил наличие: ${item}. Магазин свяжется с вами по срокам и оплате.`,
  },
  IN_DELIVERY: {
    title: "Заказ в доставке",
    text: (item, store) => `${item} отправлен магазином ${store}. Срок в пути уточняйте у продавца.`,
  },
  DONE: {
    title: "Заказ завершён",
    text: (item, store) => `Заказ ${item} в магазине ${store} закрыт. Спасибо за покупку.`,
  },
  CANCELLED: {
    title: "Заказ отменён",
    text: (item, store) => `${store} отменил заказ ${item}.`,
  },
}

/**
 * Сообщает покупателю, что магазин продвинул или отменил его заказ.
 *
 * Как и уведомление продавцу, доставка вторична: сбой не должен отменять уже
 * выполненную смену статуса.
 */
export async function notifyBuyerAboutOrderStatus(orderId: string, nextStatus: string, statusReason?: string | null) {
  const template = BUYER_STATUS_MESSAGES[nextStatus]
  if (!template) return

  try {
    const order = await prisma.partOrder.findUnique({
      where: { id: orderId },
      select: {
        itemName: true,
        buyerId: true,
        store: { select: { name: true } },
        buyer: { select: { telegramId: true, telegramVerifiedAt: true } },
      },
    })
    if (!order?.buyerId || !order.buyer) return

    const storeName = order.store?.name || "Магазин"
    const content = [
      template.text(order.itemName, storeName),
      statusReason ? `Причина: ${statusReason}` : null,
    ].filter(Boolean).join("\n")

    await prisma.notification.create({
      data: {
        userId: order.buyerId,
        title: template.title,
        content,
        type: nextStatus === "CANCELLED" ? "WARNING" : "SUCCESS",
        relatedType: "PART_ORDER",
        relatedId: orderId,
      },
    })

    if (!order.buyer.telegramId || !order.buyer.telegramVerifiedAt) return

    const miniAppUrl = getTelegramMiniAppUrl()
    await telegramApi("sendMessage", {
      chat_id: order.buyer.telegramId,
      text: [
        `<b>${escapeHtml(template.title)}</b>`,
        "",
        escapeHtml(template.text(order.itemName, storeName)),
        statusReason ? `\n<i>${escapeHtml(statusReason)}</i>` : null,
      ].filter((line) => line !== null).join("\n"),
      parse_mode: "HTML",
      reply_markup: miniAppUrl
        ? { inline_keyboard: [[{ text: "Мои заказы", web_app: { url: miniAppUrl } }]] }
        : undefined,
    })
  } catch (error) {
    console.warn("Buyer order notification was not delivered", error instanceof Error ? error.message : error)
  }
}

/**
 * Сообщает магазину, что покупатель отменил заказ.
 *
 * Отмену покупателем добавили, а продавец о ней не узнавал: заказ
 * просто исчезал из работы, и магазин мог собрать посылку по отменённой
 * заявке. О новом заказе продавцу сообщают, об отмене — теперь тоже.
 *
 * Причина уходит вместе с сообщением: «нашёл дешевле» и «ошибся с
 * количеством» — разные поводы, и по ним магазин понимает, стоит ли
 * предложить что-то взамен.
 */
export async function notifyStoreOwnerAboutCancellation(orderId: string, statusReason?: string | null) {
  try {
    const order = await prisma.partOrder.findUnique({
      where: { id: orderId },
      select: {
        itemName: true,
        quantity: true,
        store: {
          select: {
            name: true,
            ownerId: true,
            owner: { select: { telegramId: true, telegramVerifiedAt: true } },
          },
        },
      },
    })
    if (!order?.store?.ownerId) return

    const title = "Покупатель отменил заказ"
    const text = `«${order.itemName}»${order.quantity > 1 ? ` × ${order.quantity}` : ""} — заказ отменён покупателем.`
    const content = [text, statusReason ? `Причина: ${statusReason}` : null].filter(Boolean).join("\n")

    await prisma.notification.create({
      data: {
        userId: order.store.ownerId,
        title,
        content,
        type: "WARNING",
        relatedType: "PART_ORDER",
        relatedId: orderId,
      },
    })

    const owner = order.store.owner
    if (!owner?.telegramId || !owner.telegramVerifiedAt) return

    const miniAppUrl = getTelegramMiniAppUrl()
    await telegramApi("sendMessage", {
      chat_id: owner.telegramId,
      text: [
        `<b>${escapeHtml(title)}</b>`,
        "",
        escapeHtml(text),
        statusReason ? `\n<i>${escapeHtml(statusReason)}</i>` : null,
      ].filter((line) => line !== null).join("\n"),
      parse_mode: "HTML",
      reply_markup: miniAppUrl
        ? { inline_keyboard: [[{ text: "Заказы магазина", web_app: { url: miniAppUrl } }]] }
        : undefined,
    })
  } catch (error) {
    console.warn("Store cancellation notification was not delivered", error instanceof Error ? error.message : error)
  }
}
