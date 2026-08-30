import { prisma } from "@/lib/prisma"
import { getTelegramMiniAppUrl, telegramApi } from "@/lib/telegram"
import { offerSummary } from "@/lib/part-request-offer"

/* Тот же приём, что в соседнем уведомлении о заказах: Telegram
   разбирает разметку, и незакрытый угол в названии магазина сломал бы
   всё сообщение. */
function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Сообщает человеку, что по его заявке пришло предложение.
 *
 * Заявка «ищу деталь» была дорогой в один конец: форма обещала ответ в
 * течение дня, человек оставлял телефон и ждал. Даже когда магазины
 * начнут отвечать, узнать об этом было неоткуда — страницы со своими
 * заявками нет, а проверять её по расписанию никто не станет.
 *
 * Заявку оставляют и без входа: тогда уведомить некого, и остаётся
 * телефон, который человек указал сам. Это не потеря — магазин звонит
 * ему напрямую, как и обещано в форме.
 */
export async function notifyBuyerAboutPartOffer(input: {
  requestId: string
  buyerId: string | null
  partName: string | null
  storeName: string
  price: number | null
  leadTimeDays: number | null
}) {
  if (!input.buyerId) return

  try {
    const buyer = await prisma.user.findUnique({
      where: { id: input.buyerId },
      select: { telegramId: true, telegramVerifiedAt: true },
    })
    if (!buyer) return

    const detail = input.partName?.trim() || "запчасть"
    const title = "Предложение по вашей заявке"
    /* «Срок: 0 дн.» человек читает как ошибку, хотя это лучшее, что
       может ответить магазин: деталь на полке. Сводка говорит это
       словами. */
    const summary = offerSummary({ price: input.price, leadTimeDays: input.leadTimeDays })
    const content = [`${input.storeName} ответил по заявке «${detail}».`, summary || null]
      .filter(Boolean)
      .join("\n")

    await prisma.notification.create({
      data: {
        userId: input.buyerId,
        title,
        content,
        type: "SUCCESS",
        relatedType: "PART_REQUEST",
        relatedId: input.requestId,
      },
    })

    if (!buyer.telegramId || !buyer.telegramVerifiedAt) return

    const miniAppUrl = getTelegramMiniAppUrl()
    await telegramApi("sendMessage", {
      chat_id: buyer.telegramId,
      text: [`<b>${escapeHtml(title)}</b>`, "", escapeHtml(content)].join("\n"),
      parse_mode: "HTML",
      reply_markup: miniAppUrl
        ? { inline_keyboard: [[{ text: "Открыть заявки", web_app: { url: miniAppUrl } }]] }
        : undefined,
    })
  } catch (error) {
    console.warn("Part offer notification was not delivered", error instanceof Error ? error.message : error)
  }
}
