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
import { buildFuelSubscribePost } from "@/lib/fuel-subscribe-post"
import { STALE_WINDOW_MS } from "@/lib/fuel-availability"
import { hasRecentFuelChatPost, withFuelChatBroadcast } from "./fuel-chat-frequency"
import { scheduleTelegramMessageCleanup } from "./telegram-message-cleanup"
import { fuelCampaignImage } from "./fuel-campaign-image"

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
  return withFuelChatBroadcast(runFuelInvite, { chats: 0, sent: 0, skipped: 0, failed: 0 })
}

async function runFuelInvite(): Promise<InviteBroadcastResult> {
  const result: InviteBroadcastResult = { chats: 0, sent: 0, skipped: 0, failed: 0 }

  const chats = await prisma.telegramChat.findMany({
    where: { active: true, marketingEnabled: true },
    select: { id: true, title: true },
  })
  if (chats.length === 0) return result

  const now = new Date()
  const botUsername = getTelegramBotUsername() ?? undefined
  const siteUrl = absoluteUrl("/")
  const image = fuelCampaignImage()

  /* Сколько отметок за сутки — числом можно похвастаться, когда их
     достаточно. Считаем один раз на всю рассылку: цифра общая. */
  /* Интервал считается один раз на прогон: значение из env не должно
     меняться между чатами одной волны. */

  const reportsCount = await prisma.fuelAvailabilityReport
    .count({ where: { createdAt: { gte: new Date(now.getTime() - STALE_WINDOW_MS) } } })
    .catch(() => 0)

  for (const chat of chats) {
    result.chats += 1

    const recent = await hasRecentFuelChatPost(chat.id, now)
    if (recent) {
      result.skipped += 1
      continue
    }

    /* Два поста через раз, а не один и тот же каждые три часа.

       Приглашение рассказывает про сервис целиком, пост о подписке зовёт
       к одному действию и даёт выбрать марку кнопкой. Замер объясняет,
       зачем второй: двести семнадцать пользователей и три подписки — про
       главную возможность почти никто не узнал, она была одной строкой
       среди четырёх.

       Очередь считается по числу уже отправленных в этот чат: состояние
       нигде не хранится, и два процесса в одну минуту выберут одно и то
       же. */
    const sentBefore = await prisma.fuelInvitePost.count({ where: { chatId: chat.id } })
    const chatCity = cityFromChatTitle(chat.title)

    const post = sentBefore % 2 === 1 && chatCity
      ? buildFuelSubscribePost({ city: chatCity, siteUrl, botUsername })
      : buildFuelInvitePost({ city: chatCity, siteUrl, botUsername, reportsCount })

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
    await scheduleTelegramMessageCleanup(chat.id, messageId)
    result.sent += 1
  }

  return result
}
