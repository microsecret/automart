/**
 * Рассылка обсуждений форума по чатам сети.
 *
 * Форум с тринадцатью темами не растёт сам: человек не заходит проверять
 * площадку, о которой не помнит. А в чатах уже сидят те, кому вопрос
 * интересен — их надо позвать, а не ждать.
 *
 * Сборка поста — в forum-chat-post: то, что уйдёт посторонним людям,
 * проверяется тестами отдельно от базы и сети.
 */

import { prisma } from "@/lib/prisma"
import { getTelegramBotUsername } from "@/lib/telegram"
import { absoluteUrl } from "@/lib/site-url"
import { sendChatPost } from "@/lib/telegram-post-sender"
import { buildForumChatPost } from "@/lib/forum-chat-post"
import { stripForumMarkup } from "@/lib/forum-markup"

/**
 * Не чаще одной темы в сутки на чат.
 *
 * Чат — не лента форума: пришли туда за объявлениями, и поток обсуждений
 * читается как спам, даже когда каждое из них по делу.
 */
const CHAT_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * Сколько ответов нужно, чтобы позвать людей.
 *
 * Тема без единого ответа выглядит навязчиво: человек приходит по ссылке
 * и видит вопрос, на который никто не ответил. Один ответ уже показывает,
 * что разговор пошёл.
 */
const MIN_REPLIES = 1

/** Сколько дней тема считается свежей. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type ForumBroadcastResult = {
  chats: number
  sent: number
  skipped: number
  failed: number
}

/**
 * Отправляет по одной свежей теме в каждый чат, куда сегодня не слали.
 *
 * Тема выбирается для каждого чата отдельно: чат, в который вчера ушёл
 * разбор про растаможку, сегодня получит другой, а не тот же самый по
 * второму кругу.
 */
export async function broadcastForumTopics(): Promise<ForumBroadcastResult> {
  const result: ForumBroadcastResult = { chats: 0, sent: 0, skipped: 0, failed: 0 }

  const chats = await prisma.telegramChat.findMany({
    where: { active: true, marketingEnabled: true },
    select: { id: true },
  })
  if (chats.length === 0) return result

  const now = new Date()
  const botUsername = getTelegramBotUsername() ?? undefined
  const siteUrl = absoluteUrl("/")

  for (const chat of chats) {
    result.chats += 1

    /* Недавняя публикация в этом чате — пропускаем: чат не лента форума,
       и поток обсуждений читается как спам. */
    const recent = await prisma.forumChatPost.findFirst({
      where: { chatId: chat.id, publishedAt: { gt: new Date(now.getTime() - CHAT_INTERVAL_MS) } },
      select: { id: true },
    })
    if (recent) {
      result.skipped += 1
      continue
    }

    const topic = await prisma.forumTopic.findFirst({
      where: {
        deletedAt: null,
        isClosed: false,
        replyCount: { gte: MIN_REPLIES },
        createdAt: { gt: new Date(now.getTime() - MAX_AGE_MS) },
        /* В этот чат тему ещё не слали: повтор раздражает сильнее, чем
           отсутствие поста. */
        chatPosts: { none: { chatId: chat.id } },
      },
      /* Самая живая: по свежести последнего сообщения, а не создания —
           тема, где спорят третий день, интереснее вчерашней тишины. */
      orderBy: { lastPostAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        replyCount: true,
        section: { select: { title: true, slug: true } },
        author: { select: { name: true } },
        poll: { select: { id: true } },
        posts: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { content: true },
        },
      },
    })

    if (!topic || topic.posts.length === 0) {
      result.skipped += 1
      continue
    }

    const firstPost = topic.posts[0].content
    const post = buildForumChatPost(
      {
        title: topic.title,
        /* Отрывок без пометок разметки: звёздочки и решётки в чате
           выглядят мусором. */
        excerpt: stripForumMarkup(firstPost).slice(0, 400),
        authorName: topic.author.name,
        sectionTitle: topic.section.title,
        sectionSlug: topic.section.slug,
        topicSlug: topic.slug,
        images: extractImages(firstPost),
        hasPoll: topic.poll !== null,
      },
      { botUsername, siteUrl },
    )

    const messageId = await sendChatPost(chat.id, post, { buttonsCaption: "Читать обсуждение:" })
    if (!messageId) {
      result.failed += 1
      continue
    }

    await prisma.forumChatPost.create({
      data: { topicId: topic.id, chatId: chat.id, messageId },
    })
    result.sent += 1
  }

  return result
}

/**
 * Достаёт картинки из разметки сообщения.
 *
 * В посте форума картинки лежат пометкой «![](адрес)», а не отдельным
 * полем, как у объявления.
 */
function extractImages(content: string): string[] {
  const found: string[] = []
  const pattern = /!\[[^\]]*\]\((\/uploads\/[^)\s]+)\)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    found.push(match[1])
  }
  return found
}
