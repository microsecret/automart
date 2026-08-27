/**
 * Запись реакций и отметки лучшего ответа.
 *
 * Три числа меняются вместе: сама реакция, счётчик сообщения и репутация
 * его автора. Разъедься они — под сообщением будет одно число, у автора
 * другое, и восстановить правду можно только полным пересчётом по всей
 * базе.
 *
 * Правила, не трогающие базу, — в forum-reputation.ts.
 */

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { REPUTATION_WEIGHTS, canMarkBestAnswer, canReactToPost, isReactionKind } from "@/lib/forum-reputation"

export type ReactionResult =
  | { ok: true; reacted: boolean; reactionCount: number }
  | { ok: false; error: string; status: number }

/**
 * Ставит или снимает реакцию.
 *
 * Повторное нажатие снимает: это единственное поведение, которое человек
 * ожидает от значка, который уже подсвечен.
 */
export async function toggleReaction(input: {
  postId: string
  userId: string
  kind: string
}): Promise<ReactionResult> {
  if (!isReactionKind(input.kind)) {
    return { ok: false, error: "Неизвестная реакция", status: 400 }
  }

  const post = await prisma.forumPost.findUnique({
    where: { id: input.postId },
    select: { id: true, authorId: true, deletedAt: true, reactionCount: true },
  })
  if (!post) return { ok: false, error: "Сообщение не найдено", status: 404 }

  if (!canReactToPost({
    postAuthorId: post.authorId,
    viewerId: input.userId,
    postDeleted: post.deletedAt !== null,
  })) {
    /* Своё сообщение и удалённое разделены по смыслу, но ответ один:
       подсказывать, что именно не так, здесь незачем. */
    return { ok: false, error: "На это сообщение реагировать нельзя", status: 403 }
  }

  const existing = await prisma.forumReaction.findUnique({
    where: { postId_userId_kind: { postId: post.id, userId: input.userId, kind: input.kind } },
    select: { id: true },
  })

  const delta = existing ? -1 : 1

  try {
    await prisma.$transaction([
      existing
        ? prisma.forumReaction.delete({ where: { id: existing.id } })
        : prisma.forumReaction.create({
            data: { postId: post.id, userId: input.userId, kind: input.kind },
          }),
      prisma.forumPost.update({
        where: { id: post.id },
        data: { reactionCount: { increment: delta } },
      }),
      /* Репутация достаётся автору сообщения, а не тому, кто нажал:
         оценивают ответ, а не готовность оценивать. */
      prisma.user.update({
        where: { id: post.authorId },
        data: { forumReputation: { increment: delta * REPUTATION_WEIGHTS.reaction } },
      }),
    ])
  } catch (error) {
    /* Нарушение уникальности значит, что второе нажатие успело
       вклиниться между проверкой и записью. Реакция уже стоит, и это не
       сбой. */
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: "Реакция уже учтена", status: 409 }
    }
    console.error("Реакция на форуме:", error)
    return { ok: false, error: "Не удалось сохранить реакцию", status: 500 }
  }

  return { ok: true, reacted: !existing, reactionCount: post.reactionCount + delta }
}

export type BestAnswerResult =
  | { ok: true; marked: boolean }
  | { ok: false; error: string; status: number }

/**
 * Отмечает ответ как решивший вопрос.
 *
 * Отметка одна на тему: она нужна человеку, пришедшему из поиска, чтобы
 * не читать сорок сообщений, и две отметки эту задачу не решают. Повтор
 * снимает — автор темы может передумать.
 */
export async function toggleBestAnswer(input: {
  postId: string
  userId: string
}): Promise<BestAnswerResult> {
  const post = await prisma.forumPost.findUnique({
    where: { id: input.postId },
    select: {
      id: true,
      authorId: true,
      deletedAt: true,
      isBestAnswer: true,
      topicId: true,
      topic: { select: { authorId: true } },
    },
  })
  if (!post) return { ok: false, error: "Сообщение не найдено", status: 404 }

  if (!canMarkBestAnswer({
    topicAuthorId: post.topic.authorId,
    postAuthorId: post.authorId,
    viewerId: input.userId,
    postDeleted: post.deletedAt !== null,
  })) {
    return { ok: false, error: "Отметить ответ может автор темы", status: 403 }
  }

  const marking = !post.isBestAnswer

  try {
    await prisma.$transaction(async (tx) => {
      if (marking) {
        /* Прежняя отметка снимается вместе с её очками: иначе после
           смены мнения репутация осталась бы у обоих. */
        const previous = await tx.forumPost.findFirst({
          where: { topicId: post.topicId, isBestAnswer: true },
          select: { id: true, authorId: true },
        })
        if (previous) {
          await tx.forumPost.update({ where: { id: previous.id }, data: { isBestAnswer: false } })
          await tx.user.update({
            where: { id: previous.authorId },
            data: {
              forumReputation: { decrement: REPUTATION_WEIGHTS.bestAnswer },
              forumBestAnswers: { decrement: 1 },
            },
          })
        }
      }

      await tx.forumPost.update({ where: { id: post.id }, data: { isBestAnswer: marking } })
      await tx.user.update({
        where: { id: post.authorId },
        data: marking
          ? {
              forumReputation: { increment: REPUTATION_WEIGHTS.bestAnswer },
              forumBestAnswers: { increment: 1 },
            }
          : {
              forumReputation: { decrement: REPUTATION_WEIGHTS.bestAnswer },
              forumBestAnswers: { decrement: 1 },
            },
      })
    })
  } catch (error) {
    console.error("Лучший ответ на форуме:", error)
    return { ok: false, error: "Не удалось отметить ответ", status: 500 }
  }

  return { ok: true, marked: marking }
}

/**
 * Реакции на сообщения страницы разом.
 *
 * Одним запросом на всю страницу, а не по запросу на сообщение: двадцать
 * сообщений это двадцать обращений к базе там, где хватает одного.
 */
export async function loadPostReactions(postIds: string[], viewerId: string | null) {
  if (postIds.length === 0) return new Map<string, { counts: Record<string, number>; mine: string[] }>()

  const reactions = await prisma.forumReaction.findMany({
    where: { postId: { in: postIds } },
    select: { postId: true, kind: true, userId: true },
  })

  const result = new Map<string, { counts: Record<string, number>; mine: string[] }>()
  for (const postId of postIds) result.set(postId, { counts: {}, mine: [] })

  for (const reaction of reactions) {
    const entry = result.get(reaction.postId)
    if (!entry) continue
    entry.counts[reaction.kind] = (entry.counts[reaction.kind] || 0) + 1
    /* Наружу уходит только своё: кто именно нажал, на форуме о марках
       становится поводом для придирок к человеку, а не к его доводам. */
    if (viewerId && reaction.userId === viewerId) entry.mine.push(reaction.kind)
  }

  return result
}
