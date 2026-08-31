/**
 * Бот сообщает продавцу, что объявление вышло на площадку.
 *
 * Решение модератора записывалось только в колокольчик на сайте. Из ста
 * двадцати человек сто девятнадцать пришли из Telegram и на сайт заходят
 * редко: продавец отправлял машину на проверку и не узнавал о публикации,
 * пока сам не заглянет в кабинет.
 *
 * Текст и кнопки — в listing-published-message, они проверяются тестами
 * отдельно от сети и базы.
 */

import { prisma } from "@/lib/prisma"
import { telegramApi, getTelegramBotUsername } from "@/lib/telegram"
import { markTelegramContactBlocked } from "@/lib/telegram-contacts"
import { absoluteUrl } from "@/lib/site-url"
import { buildPublishedMessage } from "@/lib/listing-published-message"

/**
 * Отправляет продавцу сообщение о публикации.
 *
 * chatTitle — куда объявление ушло рассылкой; null, если никуда.
 *
 * Возвращает признак отправки, но вызывающему он нужен только для
 * журнала: уведомление — приятное дополнение, и его неудача не должна
 * отменять саму публикацию.
 */
export async function notifyListingPublished(
  listingId: string,
  chatTitle: string | null,
  options: { alreadyPublished?: boolean } = {},
): Promise<boolean> {
  try {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: {
        id: true,
        title: true,
        user: { select: { telegramId: true } },
        vehicle: { select: { id: true } },
      },
    })

    /* Без Telegram писать некуда: человек регистрировался почтой, и его
       уведомление осталось в колокольчике на сайте. */
    const telegramId = listing?.user.telegramId
    if (!listing || !telegramId) return false

    const message = buildPublishedMessage({
      /* Ссылка ведёт на страницу машины, а её адрес строится по id самой
         машины, а не объявления: у объявления свой id, и по нему
         страница отвечает «не найдено». */
      listingId: listing.vehicle?.id ?? listing.id,
      /* Продвижение адресуется идентификатором объявления, а карточка —
         идентификатором машины: это разные записи. */
      promotionId: listing.id,
      title: listing.title,
      chatTitle,
      siteUrl: absoluteUrl("/"),
      botUsername: getTelegramBotUsername() ?? undefined,
      alreadyPublished: options.alreadyPublished,
    })

    await telegramApi("sendMessage", {
      chat_id: telegramId,
      text: message.text,
      parse_mode: "HTML",
      /* Предпросмотр ссылки отвлекает от кнопок, ради которых сообщение
         и отправлено. */
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: message.buttons.map((button) => [button]) },
    })

    return true
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)

    /* Человек мог заблокировать бота или удалить учётную запись — это не
       сбой, а обычное дело: помечаем и больше не пишем. */
    if (/blocked|deactivated|chat not found/i.test(text)) {
      const owner = await prisma.listing
        .findUnique({ where: { id: listingId }, select: { user: { select: { telegramId: true } } } })
        .catch(() => null)
      if (owner?.user.telegramId) {
        await markTelegramContactBlocked(owner.user.telegramId).catch(() => undefined)
      }
      return false
    }

    console.error("Уведомление о публикации объявления:", text)
    return false
  }
}
