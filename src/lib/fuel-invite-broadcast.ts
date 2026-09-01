/**
 * Рассылка приглашения в карту АЗС по чатам сети.
 *
 * Карта наличия работает ровно настолько, насколько людей на ней. В
 * одиннадцати чатах сети сто пятнадцать тысяч подписчиков — это те самые
 * водители, которым карта нужна и которые её наполнят. Без приглашения
 * они о ней не узнают: на сайт заходят единицы.
 *
 * Сборка поста — в fuel-invite-post: то, что уйдёт посторонним людям,
 * проверяется тестами отдельно от базы и сети.
 */

import { prisma } from "@/lib/prisma"
import { getTelegramBotUsername } from "@/lib/telegram"
import { absoluteUrl } from "@/lib/site-url"
import { sendChatPost } from "@/lib/telegram-post-sender"
import { buildFuelInvitePost, cityFromChatTitle } from "@/lib/fuel-invite-post"
import { STALE_WINDOW_MS } from "@/lib/fuel-availability"

/**
 * Раз в шесть часов на чат.
 *
 * Было трое суток — из осторожности: приглашение не новость, и слишком
 * частый повтор раздражает. Но сервис карты заправок держится на числе
 * людей, а за трое суток пост уходил в глубину переписки и его не видел
 * никто, кроме тех, кто был в чате в ту минуту.
 *
 * Шесть часов — четыре захода в сутки: утро, день, вечер и ночь. Так пост
 * попадается каждому, кто заглядывает в чат хотя бы раз в день, но и не
 * идёт подряд за собственным следом.
 *
 * Владелец может поменять частоту, не трогая код: значение читается из
 * server env. Это важно именно здесь — нужный темп виден только по
 * реакции чатов, а не из кода.
 */
const DEFAULT_CHAT_INTERVAL_MS = 6 * 60 * 60 * 1000

function chatIntervalMs(): number {
  const configured = Number(process.env.FUEL_INVITE_INTERVAL_HOURS)
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_CHAT_INTERVAL_MS
  /* Не чаще часа: при более частом повторе бот выглядит сломанным, и
     первым его выкинет админ чата, а не Telegram. */
  return Math.max(1, configured) * 60 * 60 * 1000
}

/**
 * Обложка приглашения.
 *
 * Долго уходило текстом: обложка бота рассказывает про авторынок, а не про
 * заправки, и ставить её сюда значило бы обещать одно, а показывать
 * другое. Рисовать картинку из ничего хуже, чем обойтись без неё.
 *
 * Теперь для карты заправок есть своя: путь задаётся в server env, потому
 * что подменить обложку должен владелец, не трогая код и не пересобирая
 * приложение. Пустое значение возвращает прежнее поведение — пост уходит
 * текстом с кнопками, и это по-прежнему рабочий вариант.
 *
 * Файл кладётся в public/uploads и указывается путём /uploads/имя.jpg.
 *
 * Именно /uploads, а не /images: отправка читает свои снимки с диска, и
 * читает только оттуда. Ссылку на наш домен Telegram не берёт — отвечает
 * «failed to get HTTP URL content», и пост не уходит вовсе. Путь из другой
 * папки молча не сработал бы: картинка не прочиталась бы с диска, ушла
 * ссылкой и не дошла.
 */
function inviteImage(): string | null {
  const configured = process.env.FUEL_INVITE_IMAGE?.trim()
  if (!configured) return null
  /* Чужой адрес Telegram скачает сам — там ограничение не действует. */
  if (configured.startsWith("http")) return configured
  /* Свой файл — только из /uploads: иначе пост уйдёт со ссылкой, которую
     Telegram отвергнет, и не дойдёт совсем. Лучше отправить текстом. */
  if (!configured.startsWith("/uploads/")) {
    console.warn(`FUEL_INVITE_IMAGE должен указывать в /uploads, получено «${configured}» — пост уйдёт текстом`)
    return null
  }
  return configured
}

export type InviteBroadcastResult = {
  chats: number
  sent: number
  skipped: number
  failed: number
}

/**
 * Рассылает приглашение по чатам, где давно не звали.
 *
 * Город берётся из названия чата: «Авторынок Казань» → «Казань». Так пост
 * говорит про город читателя, а не про страну вообще — «карта АЗС Казани»
 * человек примеряет на себя, «карта АЗС России» нет.
 */
export async function broadcastFuelInvite(): Promise<InviteBroadcastResult> {
  const result: InviteBroadcastResult = { chats: 0, sent: 0, skipped: 0, failed: 0 }

  const chats = await prisma.telegramChat.findMany({
    where: { active: true, marketingEnabled: true },
    select: { id: true, title: true },
  })
  if (chats.length === 0) return result

  const now = new Date()
  const botUsername = getTelegramBotUsername() ?? undefined
  const siteUrl = absoluteUrl("/")
  const image = inviteImage()

  /* Сколько отметок за сутки — числом можно похвастаться, когда их
     достаточно. Считаем один раз на всю рассылку: цифра общая. */
  /* Интервал считается один раз на прогон: значение из env не должно
     меняться между чатами одной волны. */
  const intervalMs = chatIntervalMs()

  const reportsCount = await prisma.fuelAvailabilityReport
    .count({ where: { createdAt: { gte: new Date(now.getTime() - STALE_WINDOW_MS) } } })
    .catch(() => 0)

  for (const chat of chats) {
    result.chats += 1

    const recent = await prisma.fuelInvitePost.findFirst({
      where: { chatId: chat.id, publishedAt: { gt: new Date(now.getTime() - intervalMs) } },
      select: { id: true },
    })
    if (recent) {
      result.skipped += 1
      continue
    }

    const post = buildFuelInvitePost({
      city: cityFromChatTitle(chat.title),
      siteUrl,
      botUsername,
      reportsCount,
    })

    const messageId = await sendChatPost(
      chat.id,
      { photos: image ? [image] : [], caption: post.text, buttons: post.buttons },
      { buttonsCaption: "Открыть:" },
    )

    if (!messageId) {
      result.failed += 1
      continue
    }

    await prisma.fuelInvitePost.create({
      data: { chatId: chat.id, messageId },
    })
    result.sent += 1
  }

  return result
}
