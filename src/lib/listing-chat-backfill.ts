/**
 * Объявления, опубликованные до появления рассылки, уходят в чаты.
 *
 * Автопубликация срабатывает в момент одобрения модератором. Все
 * объявления, одобренные раньше, в чаты не попадут никогда — а это
 * десять машин и сто пятнадцать тысяч подписчиков, которые их не увидят.
 *
 * Отсюда же берётся и вторая работа: объявление, которое не ушло из-за
 * сбоя сети в момент одобрения, догоняет со следующим запуском. Без этого
 * единственная неудачная отправка означала бы, что машина не попадёт в
 * чат вовсе.
 *
 * Куда именно уходит объявление, решает listing-chat-autopost по городу
 * машины. Здесь только выбор, чья очередь.
 */

import { prisma } from "@/lib/prisma"
import { autopostListingToChat } from "@/lib/listing-chat-autopost"

/**
 * Сколько объявлений уходит за один запуск.
 *
 * Десять постов подряд в чат читаются как захват группы, даже когда
 * каждое объявление по делу. По одному за запуск: при запуске раз в час
 * очередь из десяти машин расходится за десять часов, и в каждом чате
 * появляется не больше одного объявления за раз.
 */
const PER_RUN = 1

/**
 * Сколько ждать после публикации, прежде чем досылать.
 *
 * Свежее объявление уходит в чат само, при одобрении. Если за полчаса
 * пост не появился — значит отправка не прошла, и досылка уместна. Без
 * этой паузы досылка гонялась бы наперегонки с автопубликацией и
 * отправляла бы то же объявление вторым постом.
 */
const SETTLE_MS = 30 * 60 * 1000

export type BackfillResult = {
  /** Сколько объявлений ждёт своей очереди. */
  pending: number
  sent: number
  failed: number
}

/**
 * Досылает в чаты объявления, которые туда не попадали.
 *
 * Возвращает счётчики для журнала: по ним видно, движется ли очередь.
 */
export async function backfillListingChatPosts(): Promise<BackfillResult> {
  const result: BackfillResult = { pending: 0, sent: 0, failed: 0 }

  const settledBefore = new Date(Date.now() - SETTLE_MS)

  const where = {
    status: "ACTIVE",
    deletedAt: null,
    /* Только машины: у запчастей своя карточка, и пост объявления её не
       описывает. */
    vehicle: { isNot: null },
    publishedAt: { lt: settledBefore },
    /* Ни одного поста ни в один чат: объявление, уже разосланное,
       повторять нельзя. */
    chatPosts: { none: {} },
  } as const

  result.pending = await prisma.listing.count({ where })
  if (result.pending === 0) return result

  /* Свежие первыми: объявление недельной давности интереснее
     месячного, а очередь всё равно разойдётся целиком. */
  const queue = await prisma.listing.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take: PER_RUN,
    select: { id: true },
  })

  for (const listing of queue) {
    const chatTitle = await autopostListingToChat(listing.id)
    if (chatTitle === null) {
      result.failed += 1
      continue
    }
    result.sent += 1
  }

  return result
}
