/**
 * Отправка поста в чат — одним сообщением.
 *
 * Telegram не позволяет прикрепить кнопки к альбому: пост уходил двумя
 * сообщениями — снимки, а под ними оторванная строка «Открыть
 * объявление:» с кнопками и предпросмотром той же ссылки. В чате это
 * читалось как два разных поста подряд.
 *
 * Одна фотография кнопки принимает. Поэтому снимки склеиваются в сетку и
 * уходят единственным изображением: в сообщении есть и все фотографии, и
 * текст, и кнопки. Склейка — в photo-collage.
 *
 * Порядок общий для объявлений и обсуждений форума: держать его в двух
 * местах значит однажды поправить одно и забыть про другое.
 */

import { telegramApi, telegramPhotoApi } from "@/lib/telegram"
import { readLocalPhotos, photoMime } from "@/lib/telegram-photo-files"
import { buildPhotoCollage, MAX_COLLAGE_PHOTOS } from "@/lib/photo-collage"
import { absoluteUrl } from "@/lib/site-url"

type PostButton = { text: string; url: string }

export type OutgoingPost = {
  photos: string[]
  /* Готовая картинка вместо файла на диске.

     Карточка новости о топливе рисуется из данных самой новости и нигде
     не хранится: складывать её в /uploads значило бы копить по файлу на
     каждое сообщение в чат — по одному в минуту, круглые сутки. */
  image?: { data: Buffer; filename: string; contentType: string } | null
  caption: string
  /* Плоский список — по кнопке в ряд, как было. Массив массивов задаёт
     ряды сам: пять кнопок выбора марки в столбик занимают полэкрана, а
     в ряд по три читаются с одного взгляда. */
  buttons: PostButton[] | PostButton[][]
}

function toKeyboardRows(buttons: OutgoingPost["buttons"]): PostButton[][] {
  if (buttons.length === 0) return []
  return Array.isArray(buttons[0])
    ? (buttons as PostButton[][]).filter((row) => row.length > 0)
    : (buttons as PostButton[]).map((button) => [button])
}

/**
 * Отправляет пост и возвращает идентификатор сообщения.
 *
 * Подпись под кнопками больше не нужна — они стоят прямо под
 * фотографией. Параметр оставлен, чтобы не править вызывающих ради
 * строки, которая нигде не видна.
 */
export async function sendChatPost(
  chatId: string,
  post: OutgoingPost,
  _options: { buttonsCaption?: string } = {},
): Promise<number | null> {
  const keyboard = { inline_keyboard: toKeyboardRows(post.buttons) }


  /* Готовая картинка уходит как есть: читать с диска нечего. */
  if (post.image) {
    const sent = await telegramPhotoApi<{ message_id: number }>(
      {
        chat_id: chatId,
        caption: post.caption,
        parse_mode: "HTML",
        reply_markup: keyboard,
      },
      {
        uploads: [{
          field: "photo",
          filename: post.image.filename,
          contentType: post.image.contentType,
          data: post.image.data,
        }],
      },
    ).catch(() => null)

    if (sent?.message_id) return sent.message_id

    /* Картинка не ушла — отправляем текстом. Сообщение о появившемся
       топливе важнее оформления: человек ждёт его, чтобы решить, ехать
       ли на заправку. */
    const fallback = await telegramApi<{ message_id: number }>("sendMessage", {
      chat_id: chatId,
      text: post.caption,
      parse_mode: "HTML",
      reply_markup: keyboard,
      disable_web_page_preview: true,
    }).catch(() => null)
    return fallback?.message_id ?? null
  }

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
  const wanted = post.photos.slice(0, MAX_COLLAGE_PHOTOS)
  const local = await readLocalPhotos(wanted)

  /* Склейка возможна, только когда все снимки прочитаны: пропущенный в
     середине оставил бы дыру в сетке. */
  const files = wanted.map((photo) => local.get(photo)).filter((data): data is Buffer => Boolean(data))
  const collage = files.length === wanted.length && files.length > 1
    ? await buildPhotoCollage(files.map((data) => ({ data })))
    : null

  if (collage) {
    const sent = await telegramPhotoApi<{ message_id: number }>(
      {
        chat_id: chatId,
        caption: post.caption,
        parse_mode: "HTML",
        reply_markup: keyboard,
      },
      {
        uploads: [{
          field: "photo",
          filename: "listing.jpg",
          contentType: "image/jpeg",
          data: collage,
        }],
      },
    ).catch(() => null)

    if (sent?.message_id) return sent.message_id
    /* Склеенная картинка не ушла — падаем на первый снимок: пост без
       части фотографий лучше, чем его отсутствие. */
  }

  const single = wanted[0]
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
