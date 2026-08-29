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
import { buildFuelInvitePost } from "@/lib/fuel-invite-post"
import { STALE_WINDOW_MS } from "@/lib/fuel-availability"

/**
 * Не чаще раза в трое суток на чат.
 *
 * Приглашение в сервис — не новость: второй раз за день оно раздражает,
 * второй раз за неделю ещё читается. Трое суток — середина, при которой
 * пост видят и те, кто заходит в чат раз в два дня.
 */
const CHAT_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000

/** Картинка приглашения — она же обложка сервиса. */
const INVITE_IMAGE = "/images/fuel-map-invite.png"

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
      { photos: [INVITE_IMAGE], caption: post.text, buttons: post.buttons },
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

/**
 * Достаёт город из названия чата.
 *
 * «Авторынок Казань» → «Казань», «АВТОРЫНОК УФА/Башкортостан» → «Уфа».
 * Общий чат страны города не имеет — там приглашение говорит про сервис
 * вообще, и это правильно: его читают из разных городов.
 */
export function cityFromChatTitle(title: string | null): string | null {
  if (!title) return null

  const cleaned = title
    .replace(/авторынок/gi, "")
    .replace(/\/.*$/, "")
    .trim()

  if (!cleaned || /росси/i.test(cleaned)) return null

  /* Приводим к обычному написанию: в названиях чатов встречается
     «АВТОРЫНОК УФА», и «карта АЗС УФА» в посте выглядит криком. */
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
}
