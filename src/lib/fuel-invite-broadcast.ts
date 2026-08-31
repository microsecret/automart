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
 * Не чаще раза в трое суток на чат.
 *
 * Приглашение в сервис — не новость: второй раз за день оно раздражает,
 * второй раз за неделю ещё читается. Трое суток — середина, при которой
 * пост видят и те, кто заходит в чат раз в два дня.
 */
const CHAT_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000

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
 * Файл кладётся в public/images и указывается путём от корня сайта,
 * например /images/fuel-map-invite.jpg: Telegram скачивает картинку по
 * ссылке сам, и она должна быть доступна снаружи.
 */
function inviteImage(): string | null {
  const configured = process.env.FUEL_INVITE_IMAGE?.trim()
  if (!configured) return null
  /* Полный адрес: Telegram ходит за картинкой из своей сети, и путь от
     корня сайта ему ничего не скажет. */
  return configured.startsWith("http") ? configured : absoluteUrl(configured)
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
  const reportsCount = await prisma.fuelAvailabilityReport
    .count({ where: { createdAt: { gte: new Date(now.getTime() - STALE_WINDOW_MS) } } })
    .catch(() => 0)

  for (const chat of chats) {
    result.chats += 1

    const recent = await prisma.fuelInvitePost.findFirst({
      where: { chatId: chat.id, publishedAt: { gt: new Date(now.getTime() - CHAT_INTERVAL_MS) } },
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
