/**
 * Отправка поста с фотографией и кнопками в чат — одним сообщением.
 *
 * Раньше пост уходил двумя: альбом со всеми снимками, а под ним отдельное
 * сообщение с кнопками — Telegram не позволяет прикрепить их к альбому.
 * В чате это выглядело как два поста подряд: сначала машина, потом
 * оторванная от неё строка «Открыть объявление:» с предпросмотром той же
 * ссылки, на которую ведёт кнопка.
 *
 * Одна фотография кнопки принимает. Поэтому в чат уходит первый снимок с
 * подписью и кнопками, а остальные человек видит на самой странице — за
 * ней он и переходит. Показать десять фотографий в чате важно меньше, чем
 * дать нажать кнопку под той, которую уже увидели.
 *
 * Порядок общий для объявлений и обсуждений форума: держать его в двух
 * местах значит однажды поправить одно и забыть про другое.
 */

import { telegramApi, telegramPhotoApi } from "@/lib/telegram"
import { readLocalPhotos, photoMime } from "@/lib/telegram-photo-files"
import { absoluteUrl } from "@/lib/site-url"

export type OutgoingPost = {
  photos: string[]
  caption: string
  buttons: { text: string; url: string }[]
}

/**
 * Отправляет пост и возвращает идентификатор сообщения.
 *
 * Подпись под кнопками больше не нужна — кнопки стоят прямо под
 * фотографией, и объяснять, к чему они, незачем. Параметр оставлен,
 * чтобы не править вызывающих ради строки, которая нигде не видна.
 */
export async function sendChatPost(
  chatId: string,
  post: OutgoingPost,
  _options: { buttonsCaption?: string } = {},
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

  /* Первый снимок — он же главный: в объявлении это общий вид машины, а
     не колесо крупным планом. Остальные ждут на странице. */
  const cover = post.photos[0]
  const local = await readLocalPhotos([cover])
  const file = local.get(cover)

  /* Свои снимки уходят байтами: ссылку на наш домен Telegram не берёт —
     отвечает «failed to get HTTP URL content». Подробности в
     telegram-photo-files. */
  const sent = file
    ? await telegramPhotoApi<{ message_id: number }>(
        {
          chat_id: chatId,
          caption: post.caption,
          parse_mode: "HTML",
          reply_markup: keyboard,
        },
        {
          uploads: [{
            field: "photo",
            filename: cover.slice(cover.lastIndexOf("/") + 1),
            contentType: photoMime(cover),
            data: file,
          }],
        },
      ).catch(() => null)
    /* Внешний адрес Telegram забирает сам — читать его неоткуда. */
    : await telegramApi<{ message_id: number }>("sendPhoto", {
        chat_id: chatId,
        photo: absoluteUrl(cover),
        caption: post.caption,
        parse_mode: "HTML",
        reply_markup: keyboard,
      }).catch(() => null)

  return sent?.message_id ?? null
}
