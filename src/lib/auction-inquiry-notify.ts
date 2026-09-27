import { prisma } from "@/lib/prisma"
import { getTelegramPageUrl, telegramApi } from "@/lib/telegram"

/**
 * Сообщает администраторам о новой заявке на импорт.
 *
 * Заявка на машину с аукциона — единственное, за что площадка берёт
 * деньги со сделки. Но о ней никто не узнавал: она ложилась в базу, а
 * маршрутизация к партнёрам при нуле партнёров отдавала её никому.
 * Замер 28.09.2026: единственная за всё время заявка (Уфа, 17.08) ждала
 * 41 день, и с клиентом так и не связались.
 *
 * Уведомление — в кабинет и в Telegram, если он подтверждён. Телефон
 * клиента в сообщение не кладём: он в админке, а Telegram — чужой сервер.
 * Сбой доставки заявку не отменяет: клиент своё действие совершил.
 */
export async function notifyStaffAboutAuctionInquiry(inquiryId: string, partnersOffered: number) {
  try {
    const inquiry = await prisma.auctionInquiry.findUnique({
      where: { id: inquiryId },
      select: {
        city: true,
        auctionListing: { select: { make: true, model: true, year: true, country: true, finalPrice: true } },
      },
    })
    if (!inquiry) return

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, telegramId: true, telegramVerifiedAt: true },
    })
    if (!admins.length) return

    const lot = inquiry.auctionListing
    const car = [lot.make, lot.model, lot.year].filter(Boolean).join(" ")
    const price = typeof lot.finalPrice === "number" ? `${lot.finalPrice.toLocaleString("ru-RU")} ₽` : null
    const title = "Новая заявка на импорт"
    const content = [
      car,
      [price, lot.country].filter(Boolean).join(" · "),
      inquiry.city ? `Город клиента: ${inquiry.city}` : null,
      // Без партнёров заявку ведёт только площадка — это надо видеть сразу.
      partnersOffered > 0 ? `Предложена партнёрам: ${partnersOffered}` : "Партнёрам не ушла — связаться должна площадка",
    ].filter(Boolean).join("\n")

    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title,
        content,
        type: "WARNING",
        relatedType: "AUCTION_INQUIRY",
        relatedId: inquiryId,
      })),
    })

    const adminUrl = getTelegramPageUrl("/admin/auctions")
    const text = [`🚗 <b>${title}</b>`, "", ...content.split("\n").map(escapeHtml), "", "Контакты клиента — в админке."].join("\n")
    await Promise.all(admins
      .filter((admin) => admin.telegramId && admin.telegramVerifiedAt)
      .map((admin) => telegramApi("sendMessage", {
        chat_id: admin.telegramId,
        text,
        parse_mode: "HTML",
        reply_markup: adminUrl ? { inline_keyboard: [[{ text: "Открыть заявки", web_app: { url: adminUrl } }]] } : undefined,
      }).catch((error: unknown) => console.warn("Auction inquiry Telegram notice failed", error instanceof Error ? error.message : error))))
  } catch (error) {
    console.warn("Auction inquiry staff notification failed", error instanceof Error ? error.message : error)
  }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
