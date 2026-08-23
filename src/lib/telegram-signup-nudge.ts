import { prisma } from "@/lib/prisma"
import { getTelegramMiniAppUrl, telegramApi } from "@/lib/telegram"
import { markTelegramContactBlocked } from "@/lib/telegram-contacts"
import {
  FIRST_NUDGE_DELAY_MS,
  NUDGE_INTERVAL_MS,
  nudgeIndex,
  nudgeText,
} from "@/lib/signup-nudge-schedule"

/**
 * Напоминание тем, кто открыл бота, но так и не завёл аккаунт.
 *
 * Человек нажимает «Начать», видит приветствие и уходит: посмотреть
 * машины можно и без регистрации, а завести аккаунт руки не дошли. Через
 * неделю он про площадку не помнит.
 *
 * Сроки и тексты живут в `signup-nudge-schedule`: этот модуль тянет базу
 * и Telegram, и проверить их здесь было бы нельзя без запуска всего
 * приложения.
 */

/** За раз — небольшая пачка: Telegram ограничивает частоту отправки. */
const BATCH_SIZE = 25

function nudgeKeyboard() {
  const miniAppUrl = getTelegramMiniAppUrl()
  if (!miniAppUrl) return undefined

  /* Через точку входа приложения, а не прямо на форму подачи: страница
     подачи закрыта проверкой прав, и человек без аккаунта улетел бы на
     форму пароля прямо внутри Telegram. Точка входа заводит его по
     Telegram ID и сама доводит до формы. */
  const createUrl = new URL("/telegram?start=create", miniAppUrl).toString()

  return {
    inline_keyboard: [
      [{ text: "🚗 Разместить объявление", web_app: { url: createUrl } }],
      [{ text: "👀 Посмотреть машины", web_app: { url: miniAppUrl } }],
    ],
  }
}

export type SignupNudgeResult = {
  checked: number
  sent: number
  blocked: number
  failed: number
}

/**
 * Одна волна напоминаний.
 *
 * Отметка об отправке ставится до самой отправки: если задача случайно
 * запустится дважды, человек не получит два одинаковых сообщения. Цена
 * ошибки в другую сторону — пропущенное напоминание — куда меньше.
 */
export async function processSignupNudges(now = new Date()): Promise<SignupNudgeResult> {
  const firstDue = new Date(now.getTime() - FIRST_NUDGE_DELAY_MS)
  const repeatDue = new Date(now.getTime() - NUDGE_INTERVAL_MS)

  const candidates = await prisma.telegramContact.findMany({
    where: {
      registered: false,
      blocked: false,
      // Знакомство с ботом было достаточно давно.
      startedAt: { lte: firstDue },
      OR: [
        { lastBroadcastAt: null },
        { lastBroadcastAt: { lte: repeatDue } },
      ],
    },
    orderBy: { startedAt: "asc" },
    take: BATCH_SIZE,
    select: { telegramId: true, firstName: true, startedAt: true },
  })

  const result: SignupNudgeResult = { checked: candidates.length, sent: 0, blocked: 0, failed: 0 }

  for (const contact of candidates) {
    const index = nudgeIndex(contact.startedAt, now)
    if (index < 0) continue

    // Отметка до отправки: повторный запуск задачи не должен слать
    // второе сообщение.
    await prisma.telegramContact.update({
      where: { telegramId: contact.telegramId },
      data: { lastBroadcastAt: now },
    })

    try {
      await telegramApi("sendMessage", {
        chat_id: contact.telegramId,
        text: nudgeText(index, contact.firstName),
        parse_mode: "HTML",
        reply_markup: nudgeKeyboard(),
        // Ссылка на сайт не должна разворачиваться в карточку: она
        // отвлекает от кнопок, ради которых сообщение и отправлено.
        disable_web_page_preview: true,
      })
      result.sent += 1
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      if (/blocked|deactivated|chat not found/i.test(text)) {
        await markTelegramContactBlocked(contact.telegramId).catch(() => undefined)
        result.blocked += 1
        continue
      }
      result.failed += 1
      console.error(`[signup-nudge] Не доставлено ${contact.telegramId}:`, text)
    }
  }

  return result
}
