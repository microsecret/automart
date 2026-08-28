/**
 * Отправка поста с фотографиями и кнопками в чат.
 *
 * Telegram не позволяет прикрепить кнопки к альбому, поэтому пост уходит
 * двумя сообщениями: сначала снимки, следом кнопки ответом на альбом —
 * так они привязаны к нему и не выглядят отдельным постом ни к чему.
 *
 * Второе сообщение раньше тянуло предпросмотр ссылки: под кнопками
 * появлялась карточка той же страницы, на которую они ведут, и пост
 * читался как два разных. Предпросмотр отключён.
 *
 * Порядок общий для объявлений и обсуждений форума: держать его в двух
 * местах значит однажды поправить одно и забыть про другое.
 */

import { telegramApi, telegramPhotoApi, type TelegramUpload } from "@/lib/telegram"
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

  /* Свои снимки читаются с диска: ссылку на наш домен Telegram не берёт —
     отвечает «failed to get HTTP URL content». Подробности в
     telegram-photo-files. */
  const local = await readLocalPhotos(post.photos)

  /* Одна фотография принимает кнопки прямо на себя — тогда пост уходит
     единственным сообщением, и это лучший случай. */
  if (post.photos.length === 1) {
    const single = post.photos[0]
    const file = local.get(single)

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
              filename: single.slice(single.lastIndexOf("/") + 1),
              contentType: photoMime(single),
              data: file,
            }],
          },
        ).catch(() => null)
      /* Внешний адрес Telegram забирает сам — читать его неоткуда. */
      : await telegramApi<{ message_id: number }>("sendPhoto", {
          chat_id: chatId,
          photo: absoluteUrl(single),
          caption: post.caption,
          parse_mode: "HTML",
          reply_markup: keyboard,
        }).catch(() => null)

    return sent?.message_id ?? null
  }

  /* Файлы в альбоме называются по имени поля через «attach://» — так
     Telegram связывает описание вложения с его байтами в теле запроса. */
  const uploads: TelegramUpload[] = []
  const media = post.photos.map((photo, index) => {
    const file = local.get(photo)
    const caption = index === 0
      /* Подпись только у первой: Telegram показывает её под альбомом, а
         повторённая на каждой фотографии дублируется в уведомлениях. */
      ? { caption: post.caption, parse_mode: "HTML" }
      : {}

    if (!file) return { type: "photo", media: absoluteUrl(photo), ...caption }

    const field = `photo${index}`
    uploads.push({
      field,
      filename: photo.slice(photo.lastIndexOf("/") + 1),
      contentType: photoMime(photo),
      data: file,
    })
    return { type: "photo", media: `attach://${field}`, ...caption }
  })

  const album = uploads.length
    ? await telegramPhotoApi<{ message_id: number }[]>(
        { chat_id: chatId, media },
        { method: "sendMediaGroup", uploads },
      ).catch(() => null)
    : await telegramApi<{ message_id: number }[]>("sendMediaGroup", {
        chat_id: chatId,
        media,
      }).catch(() => null)

  if (!album?.length) return null

  await telegramApi("sendMessage", {
    chat_id: chatId,
    text: options.buttonsCaption || "Открыть:",
    reply_to_message_id: album[0].message_id,
    reply_markup: keyboard,
    /* Без этого под кнопками появлялась карточка той же страницы, на
       которую они ведут, и пост читался как два разных сообщения. */
    disable_web_page_preview: true,
  }).catch(() => {})

  return album[0].message_id
}
