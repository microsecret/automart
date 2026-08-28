/**
 * Что появилось на форуме с прошлого захода.
 *
 * «Что нового» — главный сценарий возврата постоянного читателя. Без
 * отметки он каждый раз перечитывает список глазами, вспоминая, что уже
 * видел, и в какой-то момент перестаёт заходить вовсе.
 *
 * Отметка одна на человека, а не запись по каждой теме: полная
 * прочитанность потребовала бы строки на каждый заход в каждую тему, то
 * есть тысяч записей ради подсветки, которую видно и так.
 */

import { prisma } from "@/lib/prisma"

/**
 * Насколько давний заход ещё считаем «прошлым».
 *
 * Человек, не бывавший здесь полгода, увидел бы новым весь форум — это
 * не подсветка, а сплошная заливка, и она не помогает ничему. Две недели
 * покрывают обычный ритм: заглянул, пропал на неделю, вернулся.
 */
export const VISIT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

/**
 * Читает прошлый заход и отмечает нынешний.
 *
 * Порядок важен: сначала читаем прежнее значение, потом записываем
 * новое. Запиши мы сначала — подсвечивать было бы нечего, потому что
 * «прошлый заход» стал бы этой самой секундой.
 *
 * Запись не ждём: она не влияет на то, что показывается сейчас, а
 * задержка страницы ради отметки не оправдана.
 */
export async function readAndMarkVisit(userId: string | null): Promise<Date | null> {
  if (!userId) return null

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { forumLastVisitAt: true },
    })

    const now = new Date()
    void prisma.user
      .update({ where: { id: userId }, data: { forumLastVisitAt: now } })
      .catch(() => {})

    const previous = user?.forumLastVisitAt ?? null
    if (!previous) return null

    /* Слишком давний заход не считаем: иначе новым окажется весь форум. */
    if (now.getTime() - previous.getTime() > VISIT_WINDOW_MS) return null

    return previous
  } catch (error) {
    console.error("Отметка захода на форум:", error)
    return null
  }
}

/**
 * Появилось ли новое в теме с прошлого захода.
 *
 * Автор последнего сообщения не проверяется: чтобы его узнать, пришлось
 * бы тянуть по запросу на каждую из двадцати пяти тем страницы. Свой же
 * ответ подсветится — мелочь рядом с этой ценой, и человек всё равно
 * помнит, где отвечал.
 */
export function hasNewSince(input: {
  lastPostAt: Date
  lastVisitAt: Date | null
}): boolean {
  if (!input.lastVisitAt) return false
  return input.lastPostAt.getTime() > input.lastVisitAt.getTime()
}
