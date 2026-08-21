import { prisma } from "@/lib/prisma"
import { telegramApi } from "@/lib/telegram"
import { markTelegramContactBlocked } from "@/lib/telegram-contacts"
import { audienceWhere, type BroadcastAudience } from "@/lib/telegram-broadcast-audience"

/**
 * Массовая рассылка по всем, кто открывал бота.
 *
 * Отправляет тем, кто нажал «Начать», даже если регистрацию не закончил —
 * ради этой аудитории учёт и вводился.
 *
 * Telegram ограничивает ботов примерно тридцатью сообщениями в секунду и
 * жёстко наказывает за превышение: сначала 429 с retry_after, затем временная
 * блокировка бота целиком. Поэтому отправка идёт пачками с паузой, а не
 * параллельно.
 */

/** Сообщений в секунду. Двадцать вместо тридцати — запас на пики трафика. */
const MESSAGES_PER_SECOND = 20

/** Размер пачки: столько уходит, потом пауза. */
const BATCH_SIZE = 20

export type { BroadcastAudience }

export type BroadcastResult = {
  audience: BroadcastAudience
  total: number
  delivered: number
  blocked: number
  failed: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function sendTelegramBroadcast(input: {
  text: string
  audience: BroadcastAudience
  /** Ограничение на число получателей — для пробной отправки. */
  limit?: number
  /** Кто отправил: рассылка доступна нескольким администраторам. */
  sentBy?: { id?: string | null; name?: string | null }
}): Promise<BroadcastResult> {
  const text = input.text.trim()
  if (!text) throw new Error("Пустое сообщение")

  const contacts = await prisma.telegramContact.findMany({
    where: audienceWhere(input.audience),
    select: { telegramId: true },
    orderBy: { lastSeenAt: "desc" },
    ...(input.limit ? { take: input.limit } : {}),
  })

  let delivered = 0
  let blocked = 0
  let failed = 0
  const now = new Date()

  for (let index = 0; index < contacts.length; index += BATCH_SIZE) {
    const batch = contacts.slice(index, index + BATCH_SIZE)

    for (const contact of batch) {
      try {
        await telegramApi("sendMessage", {
          chat_id: contact.telegramId,
          text,
          parse_mode: "HTML",
          // Ссылки в тексте не разворачиваются: превью растягивает рассылку
          // и часто подтягивает не ту картинку.
          disable_web_page_preview: true,
        })
        delivered += 1
        await prisma.telegramContact.updateMany({
          where: { telegramId: contact.telegramId },
          data: { lastBroadcastAt: now },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (/blocked by the user|chat not found|user is deactivated/i.test(message)) {
          // Больше не пишем: человек закрыл диалог или удалил аккаунт.
          await markTelegramContactBlocked(contact.telegramId)
          blocked += 1
        } else {
          console.error(`[broadcast] Не доставлено ${contact.telegramId}:`, message)
          failed += 1
        }
      }
    }

    // Пауза между пачками держит темп ниже лимита Telegram.
    if (index + BATCH_SIZE < contacts.length) {
      await sleep(Math.ceil((BATCH_SIZE / MESSAGES_PER_SECOND) * 1000))
    }
  }

  const result = { audience: input.audience, total: contacts.length, delivered, blocked, failed }

  // Запись в журнал не должна ронять уже выполненную рассылку: сообщения
  // отправлены, и потеря строки в истории — меньшая беда, чем ошибка 500
  // в ответе, после которой администратор нажмёт «Отправить» ещё раз.
  try {
    await prisma.telegramBroadcast.create({
      data: {
        text,
        audience: input.audience,
        total: result.total,
        delivered,
        blocked,
        failed,
        sentById: input.sentBy?.id || null,
        sentByName: input.sentBy?.name || null,
      },
    })
  } catch (error) {
    console.error("[broadcast] Не удалось записать в журнал:", error)
  }

  return result
}
