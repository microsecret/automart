import { prisma } from "@/lib/prisma"
import { getTelegramBotUsername, getTelegramRegistrationStep, telegramApi } from "@/lib/telegram"
import { buildReminderText, resumeButtonLabel, type PendingStep } from "@/lib/telegram-registration-copy"

/**
 * Напоминания о незавершённой регистрации.
 *
 * Человек подтверждает телефон одним нажатием, а почту и пароль нужно набирать
 * руками — на этом теряется заметная часть. Он при этом остаётся в группе, где
 * бот удаляет его сообщения, и не понимает, почему.
 *
 * Здесь мы пишем таким людям в личный чат и зовём продолжить ровно с того шага,
 * где они остановились.
 */

/** Первое напоминание — пока человек ещё помнит, о чём речь. */
const FIRST_DELAY_MS = 2 * 60 * 60 * 1000

/** Последующие — раз в сутки. */
const REPEAT_DELAY_MS = 24 * 60 * 60 * 1000

/**
 * После трёх попыток бот замолкает навсегда: кто не захотел, тот не захотел, а
 * назойливость приводит к блокировке бота и жалобам на спам.
 */
const MAX_REMINDERS = 3

const BATCH_SIZE = 20

function reminderKeyboard(step: PendingStep) {
  const username = getTelegramBotUsername()
  if (!username) return undefined
  return {
    inline_keyboard: [
      [{ text: resumeButtonLabel(step), url: `https://t.me/${username}?start=register` }],
    ],
  }
}

/**
 * Одна волна напоминаний.
 *
 * Кандидаты отбираются по времени последнего напоминания, а сам факт отправки
 * фиксируется атомарно: если задача случайно запустится дважды, человек не
 * получит два одинаковых сообщения.
 */
export async function processRegistrationReminders(now = new Date()) {
  const firstDue = new Date(now.getTime() - FIRST_DELAY_MS)
  const repeatDue = new Date(now.getTime() - REPEAT_DELAY_MS)

  const candidates = await prisma.user.findMany({
    where: {
      telegramId: { not: null },
      regReminderCount: { lt: MAX_REMINDERS },
      // Завершившие регистрацию отсекаются сразу, а не в цикле: иначе они
      // занимали бы пачку, вытесняя тех, кому напоминание и адресовано.
      // Условие повторяет getTelegramRegistrationStep: незавершённой считается
      // регистрация без подтверждённой почты либо без пароля.
      NOT: {
        AND: [
          { telegramVerifiedAt: { not: null } },
          { phone: { not: null } },
          { emailVerified: { not: null } },
          { hashedPassword: { not: null } },
        ],
      },
      OR: [
        { regReminderAt: null, createdAt: { lte: firstDue } },
        { regReminderAt: { lte: repeatDue } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      phone: true,
      telegramId: true,
      telegramVerifiedAt: true,
      hashedPassword: true,
      regReminderAt: true,
      regReminderCount: true,
    },
    orderBy: [{ regReminderAt: "asc" }, { createdAt: "asc" }],
    take: BATCH_SIZE,
  })

  let delivered = 0
  let skipped = 0
  let failed = 0

  for (const user of candidates) {
    const step = getTelegramRegistrationStep(user)
    if (step === "complete" || !user.telegramId) {
      skipped += 1
      continue
    }

    // Захватываем попытку до отправки: повторный запуск не найдёт эту запись.
    const claimed = await prisma.user.updateMany({
      where: {
        id: user.id,
        regReminderCount: user.regReminderCount,
        ...(user.regReminderAt ? { regReminderAt: user.regReminderAt } : { regReminderAt: null }),
      },
      data: { regReminderAt: now, regReminderCount: { increment: 1 } },
    })
    if (claimed.count !== 1) {
      skipped += 1
      continue
    }

    try {
      await telegramApi("sendMessage", {
        chat_id: user.telegramId,
        text: buildReminderText(step, user.name),
        parse_mode: "HTML",
        reply_markup: reminderKeyboard(step),
      })
      delivered += 1
    } catch (error) {
      // Человек мог заблокировать бота или удалить чат. Счётчик уже увеличен,
      // поэтому попытки не будут повторяться бесконечно.
      console.error(`[registration-reminder] Не доставлено пользователю ${user.id}:`, error)
      failed += 1
    }
  }

  return { candidates: candidates.length, delivered, skipped, failed }
}
