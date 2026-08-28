/**
 * Отправка поста с фотографиями и кнопками в чат.
 *
 * Один и тот же порядок нужен и объявлениям, и обсуждениям форума:
 * несколько фотографий уходят альбомом, а кнопки — отдельным сообщением
 * следом, потому что Telegram не поддерживает кнопки на альбоме. Держать
 * это в двух местах значит однажды поправить одно и забыть про другое.
 */

import { telegramApi } from "@/lib/telegram"
import { absoluteUrl } from "@/lib/site-url"

export type OutgoingPost = {
  photos: string[]
  caption: string
  buttons: { text: string; url: string }[]
}

/**
 * Отправляет пост и возвращает идентификатор сообщения.
 *
 * Подпись под кнопками задаётся вызывающим: у объявления это «Открыть
 * объявление», у обсуждения — «Читать обсуждение», и общая формулировка
 * звучала бы мимо в обоих случаях.
 */
export async function sendChatPost(
  chatId: string,
  post: OutgoingPost,
  options: { buttonsCaption?: string } = {},
): Promise<number | null> {
  const keyboard = { inline_keyboard: post.buttons.map((button) => [button]) }

  if (post.photos.length === 0) {
    const sent = await telegramApi<{ message_id: number }>("sendMessage", {
      chat_id: chatId,
      text: post.caption,
      parse_mode: "HTML",
      reply_markup: keyboard,
      /* Предпросмотр ссылки не нужен: он занимает место под постом и
         показывает ту же страницу, на которую ведёт кнопка. */
      disable_web_page_preview: true,
    }).catch(() => null)
    return sent?.message_id ?? null
  }

  if (post.photos.length === 1) {
    const sent = await telegramApi<{ message_id: number }>("sendPhoto", {
      chat_id: chatId,
      photo: absoluteUrl(post.photos[0]),
      caption: post.caption,
      parse_mode: "HTML",
      reply_markup: keyboard,
    }).catch(() => null)
    return sent?.message_id ?? null
  }

  const album = await telegramApi<{ message_id: number }[]>("sendMediaGroup", {
    chat_id: chatId,
    media: post.photos.map((photo, index) => ({
      type: "photo",
      media: absoluteUrl(photo),
      /* Подпись только у первой: Telegram показывает её под альбомом, а
         повторённая на каждой фотографии дублируется в уведомлениях. */
      ...(index === 0 ? { caption: post.caption, parse_mode: "HTML" } : {}),
    })),
  }).catch(() => null)

  if (!album?.length) return null

  /* Кнопки следом, ответом на альбом: так они привязаны к нему визуально
     и не выглядят отдельным сообщением ни к чему. */
  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: options.buttonsCaption || "Открыть:",
    reply_to_message_id: album[0].message_id,
    reply_markup: keyboard,
  }).catch(() => {})

  return album[0].message_id
}
