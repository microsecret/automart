import { prisma } from "@/lib/prisma"

/**
 * Учёт всех, кто открыл диалог с ботом.
 *
 * Раньше человек, нажавший «Начать» и не подтвердивший телефон, нигде не
 * сохранялся — а именно такие и составляют основную аудиторию рассылки:
 * зарегистрированных на площадке единицы, а бот открывали десятки.
 */

type ContactIdentity = {
  telegramId: string
  username?: string | null
  firstName?: string | null
  lastName?: string | null
}

/**
 * Отметить контакт при любом сообщении из личного чата.
 *
 * Вызывается на каждое сообщение, поэтому не должен ронять обработку: если
 * запись не удалась, человек всё равно продолжит разговор с ботом.
 */
export async function touchTelegramContact(identity: ContactIdentity, registered?: boolean) {
  const now = new Date()
  const profile = {
    username: identity.username?.trim().replace(/^@/, "") || null,
    firstName: identity.firstName?.trim() || null,
    lastName: identity.lastName?.trim() || null,
  }

  try {
    await prisma.telegramContact.upsert({
      where: { telegramId: identity.telegramId },
      create: {
        telegramId: identity.telegramId,
        ...profile,
        registered: registered ?? false,
        startedAt: now,
        lastSeenAt: now,
      },
      update: {
        ...profile,
        lastSeenAt: now,
        // Написал снова — значит бот разблокирован.
        blocked: false,
        ...(registered === undefined ? {} : { registered }),
      },
    })
  } catch (error) {
    console.error("[telegram-contacts] Не удалось отметить контакт:", error)
  }
}

/** Пометить, что человек заблокировал бота: рассылка ему больше не идёт. */
export async function markTelegramContactBlocked(telegramId: string) {
  try {
    await prisma.telegramContact.updateMany({
      where: { telegramId },
      data: { blocked: true },
    })
  } catch (error) {
    console.error("[telegram-contacts] Не удалось отметить блокировку:", error)
  }
}

/** Сводка для админки: сколько людей открыло бота и до чего дошло. */
export async function getTelegramContactStats() {
  const [total, registered, blocked, last24h, last7d] = await Promise.all([
    prisma.telegramContact.count(),
    prisma.telegramContact.count({ where: { registered: true } }),
    prisma.telegramContact.count({ where: { blocked: true } }),
    prisma.telegramContact.count({
      where: { lastSeenAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
    }),
    prisma.telegramContact.count({
      where: { lastSeenAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60_000) } },
    }),
  ])

  // Дата включения полного учёта: до неё сохранялись только те, кто дошёл до
  // подтверждения телефона. Показываем её в админке, чтобы «всего открывали
  // бота» не читалось как полная история — она началась именно отсюда.
  const trackingSince = new Date("2026-08-21T13:50:00Z")

  return {
    trackingSince: trackingSince.toISOString(),
    total,
    registered,
    // Те, ради кого всё и затевалось: открыли бота, но не дошли до конца.
    unregistered: total - registered,
    blocked,
    reachable: total - blocked,
    active24h: last24h,
    active7d: last7d,
  }
}
