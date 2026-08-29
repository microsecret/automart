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
 * Приглашение уходит текстом, без картинки.
 *
 * Обложка бота рассказывает про авторынок, а не про заправки, и ставить
 * её сюда значило бы обещать одно, а показывать другое. Рисовать картинку
 * из ничего хуже, чем обойтись без неё: пост и так уходит одним
 * сообщением с кнопками, а первая строка текста работает лучше любой
 * заставки — человек читает её, а не разглядывает.
 *
 * Когда появится настоящий снимок карты с метками, он встанет сюда одной
 * строкой.
 */
const INVITE_IMAGE: string | null = null

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
      { photos: INVITE_IMAGE ? [INVITE_IMAGE] : [], caption: post.text, buttons: post.buttons },
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
