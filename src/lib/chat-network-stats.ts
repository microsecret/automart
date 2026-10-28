import { prisma } from "@/lib/prisma"
import { telegramApi } from "@/lib/telegram"
import { REPOST_INTERVAL_MS } from "@/lib/chat-promotion-delivery"
import type { ChatNetwork } from "@/lib/promotion-nudge-rules"

/**
 * Живые цифры сети чатов для рекламы платного показа.
 *
 * Чаты — те же, куда идёт оплаченная публикация (active + marketingEnabled),
 * участники — ответ Telegram на getChatMemberCount по каждому. Число
 * меняется медленно, а восемнадцать запросов к Telegram на каждое
 * сообщение были бы лишними: результат держится шесть часов.
 *
 * Если Telegram не ответил ни по одному чату, участники не называются
 * вовсе — лучше промолчать, чем написать ноль или выдумать число.
 */

const CACHE_MS = 6 * 60 * 60 * 1000
let cached: { at: number; value: ChatNetwork } | null = null

export async function getChatNetworkStats(now = Date.now()): Promise<ChatNetwork> {
  if (cached && now - cached.at < CACHE_MS) return cached.value

  const chats = await prisma.telegramChat.findMany({
    where: { active: true, marketingEnabled: true },
    select: { id: true },
  })

  let members = 0
  let answered = 0
  for (const chat of chats) {
    const count = await telegramApi<number>("getChatMemberCount", { chat_id: chat.id }).catch(() => null)
    if (typeof count === "number" && count > 0) {
      members += count
      answered += 1
    }
  }

  const value: ChatNetwork = {
    chats: chats.length,
    members: answered > 0 ? members : null,
    repostDays: Math.round(REPOST_INTERVAL_MS / (24 * 60 * 60 * 1000)),
  }
  cached = { at: now, value }
  return value
}
