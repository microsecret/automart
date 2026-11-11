import { prisma } from "@/lib/prisma"
import { telegramApi } from "@/lib/telegram"
import type { ChatNetwork } from "@/lib/promotion-nudge-rules"

/**
 * Живые цифры сети чатов для рекламы платного показа.
 *
 * Чаты — те же, куда идёт оплаченная публикация (active + marketingEnabled),
 * участники — ответ Telegram на getChatMemberCount по каждому. Число
 * меняется медленно, а восемнадцать запросов к Telegram на каждое
 * сообщение были бы лишними: результат держится шесть часов.
 *
 * Общую численность показываем, когда Telegram ответил по всем чатам.
 */

const CACHE_MS = 6 * 60 * 60 * 1000
const INCOMPLETE_CACHE_MS = 5 * 60 * 1000
const REQUEST_BATCH_SIZE = 4
type NetworkSnapshot = ChatNetwork & { checkedAt: Date | null }
let cached: { expiresAt: number; value: NetworkSnapshot } | null = null
let inFlight: Promise<NetworkSnapshot> | null = null

export async function getChatNetworkStats(): Promise<NetworkSnapshot> {
  if (cached && Date.now() < cached.expiresAt) return cached.value
  if (!inFlight) {
    inFlight = measureChatNetwork().finally(() => { inFlight = null })
  }
  return inFlight
}

async function measureChatNetwork(): Promise<NetworkSnapshot> {
  const chats = await prisma.telegramChat.findMany({
    where: { active: true, marketingEnabled: true },
    select: { id: true },
  })

  let members = 0
  let answered = 0
  for (let offset = 0; offset < chats.length; offset += REQUEST_BATCH_SIZE) {
    const counts = await Promise.all(chats.slice(offset, offset + REQUEST_BATCH_SIZE).map(({ id }) =>
      telegramApi<number>("getChatMemberCount", { chat_id: id }).catch(() => null),
    ))
    for (const count of counts) {
      if (typeof count === "number" && Number.isSafeInteger(count) && count > 0) {
        members += count
        answered += 1
      }
    }
  }

  const finishedAt = new Date()
  const complete = answered > 0 && answered === chats.length
  const value: NetworkSnapshot = {
    chats: chats.length,
    members: complete ? members : null,
    checkedAt: complete ? finishedAt : null,
    repostDays: 1,
  }
  cached = { expiresAt: +finishedAt + (complete ? CACHE_MS : INCOMPLETE_CACHE_MS), value }
  return value
}
