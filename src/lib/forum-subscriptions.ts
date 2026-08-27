/**
 * Подписки на темы и уведомления об ответах.
 *
 * Человек спросил и ушёл: без уведомления он не узнает, что ответили, и
 * вернётся разве что случайно. Это главный сценарий возврата на форум, и
 * без него площадка живёт только за счёт тех, кто заходит проверять сам.
 */

import { prisma } from "@/lib/prisma"

/** Сколько подписчиков уведомляем за один ответ. */
const NOTIFY_LIMIT = 200

/**
 * Уведомляет подписчиков темы о новом ответе.
 *
 * Написавшего пропускаем: он только что видел свой текст, и уведомление
 * о самом себе выглядит поломкой.
 *
 * Сбой уведомлений не должен ронять публикацию: ответ уже написан и
 * сохранён, а не дошедшее письмо — потеря меньшая, чем потерянный текст.
 */
export async function notifyTopicSubscribers(input: {
  topicId: string
  topicTitle: string
  topicSlug: string
  sectionSlug: string
  authorId: string
  authorName: string | null
}): Promise<void> {
  try {
    const subscribers = await prisma.forumSubscription.findMany({
      where: { topicId: input.topicId, userId: { not: input.authorId } },
      select: { userId: true },
      take: NOTIFY_LIMIT,
    })
    if (subscribers.length === 0) return

    const who = input.authorName || "Участник"
    await prisma.notification.createMany({
      data: subscribers.map((subscriber) => ({
        userId: subscriber.userId,
        type: "INFO",
        title: "Новый ответ в теме",
        /* Заголовок темы в тексте: в списке уведомлений «вам ответили»
           без указания темы ничего не говорит, когда подписок десяток. */
        content: `${who} ответил в теме «${input.topicTitle}»`,
        relatedId: input.topicId,
        relatedType: "FORUM_TOPIC",
      })),
    })
  } catch (error) {
    console.error("Уведомления подписчикам темы:", error)
  }
}

export type SubscriptionResult =
  | { ok: true; subscribed: boolean }
  | { ok: false; error: string; status: number }

/**
 * Подписывает или отписывает от темы.
 *
 * Повторное нажатие снимает подписку: это единственное поведение,
 * которое человек ожидает от кнопки, которая уже подсвечена.
 */
export async function toggleSubscription(input: {
  topicId: string
  userId: string
}): Promise<SubscriptionResult> {
  const topic = await prisma.forumTopic.findFirst({
    where: { id: input.topicId, deletedAt: null },
    select: { id: true },
  })
  if (!topic) return { ok: false, error: "Тема не найдена", status: 404 }

  const existing = await prisma.forumSubscription.findUnique({
    where: { topicId_userId: { topicId: topic.id, userId: input.userId } },
    select: { id: true },
  })

  try {
    if (existing) {
      await prisma.forumSubscription.delete({ where: { id: existing.id } })
      return { ok: true, subscribed: false }
    }
    await prisma.forumSubscription.create({
      data: { topicId: topic.id, userId: input.userId },
    })
    return { ok: true, subscribed: true }
  } catch (error) {
    console.error("Подписка на тему форума:", error)
    return { ok: false, error: "Не удалось изменить подписку", status: 500 }
  }
}

/** Подписан ли человек на тему. */
export async function isSubscribed(topicId: string, userId: string | null): Promise<boolean> {
  if (!userId) return false
  const existing = await prisma.forumSubscription.findUnique({
    where: { topicId_userId: { topicId, userId } },
    select: { id: true },
  })
  return existing !== null
}
