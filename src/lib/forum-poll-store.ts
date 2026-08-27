/**
 * Запись голоса в опросе.
 *
 * Счётчик голосов хранится полем варианта, а не считается запросом:
 * страница темы открывается на каждый заход, и COUNT по всем голосам при
 * живом опросе стал бы самым дорогим запросом страницы. Поэтому голос и
 * счётчик меняются одной сделкой — иначе цифра под опросом разойдётся с
 * числом записанных голосов.
 *
 * Правила опроса, не трогающие базу, лежат в forum-poll.ts.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isPollClosed } from "@/lib/forum-poll"

export type PollVoteResult =
  | { ok: true }
  | { ok: false; error: string; status: number }

/**
 * Записывает голос.
 *
 * Голос и счётчик меняются одной сделкой. Уникальность пары «вариант и
 * человек» стоит в базе: два нажатия подряд с телефона уходят двумя
 * запросами одновременно, и проверка «уже голосовал» в коде пропустила
 * бы оба — счётчик вырос бы на два при одном участнике.
 */
export async function castPollVote(input: {
  pollId: string
  optionIds: string[]
  userId: string
}): Promise<PollVoteResult> {
  const poll = await prisma.forumPoll.findUnique({
    where: { id: input.pollId },
    select: {
      id: true,
      multiple: true,
      closesAt: true,
      options: { select: { id: true } },
    },
  })

  if (!poll) return { ok: false, error: "Опрос не найден", status: 404 }
  if (isPollClosed(poll)) return { ok: false, error: "Голосование завершено", status: 409 }

  const known = new Set(poll.options.map((option) => option.id))
  const chosen = Array.from(new Set(input.optionIds)).filter((id) => known.has(id))

  if (chosen.length === 0) return { ok: false, error: "Выберите вариант", status: 400 }
  if (!poll.multiple && chosen.length > 1) {
    return { ok: false, error: "В этом опросе можно выбрать только один вариант", status: 400 }
  }

  /* Голосовать можно один раз: смена мнения не предусмотрена намеренно.
     Возможность переголосовать превращает опрос в перетягивание каната,
     когда в теме появляется заинтересованная сторона. */
  const already = await prisma.forumPollVote.findFirst({
    where: { pollId: poll.id, userId: input.userId },
    select: { id: true },
  })
  if (already) return { ok: false, error: "Вы уже голосовали", status: 409 }

  try {
    await prisma.$transaction([
      prisma.forumPollVote.createMany({
        data: chosen.map((optionId) => ({ pollId: poll.id, optionId, userId: input.userId })),
      }),
      ...chosen.map((optionId) =>
        prisma.forumPollOption.update({
          where: { id: optionId },
          data: { votes: { increment: 1 } },
        }),
      ),
    ])
  } catch (error) {
    /* Нарушение уникальности значит, что второй запрос того же человека
       успел вклиниться между проверкой и записью. Это не сбой: голос уже
       учтён, и человеку так и надо сказать. */
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Вы уже голосовали", status: 409 }
    }
    console.error("Голос в опросе форума:", error)
    return { ok: false, error: "Не удалось записать голос", status: 500 }
  }

  return { ok: true }
}
