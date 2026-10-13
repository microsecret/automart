import { prisma } from "@/lib/prisma"
import { getTelegramPageUrl, telegramApi } from "@/lib/telegram"

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/**
 * Уведомление всем администраторам — в кабинет и в Telegram.
 *
 * То, что требует решения сотрудника (анкета продавца, заявка на импорт),
 * не должно молча лежать в базе: единственная за всё время заявка на
 * импорт ждала 41 день, потому что о ней никто не узнал.
 * Сбой доставки не роняет действие, ради которого уведомляем.
 */
export async function notifyAdmins(input: {
  title: string
  lines: string[]
  relatedType: string
  relatedId: string
  /** Раздел админки для кнопки в Telegram. */
  adminPath: string
  buttonText: string
}) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true, telegramId: true, telegramVerifiedAt: true },
    })
    if (!admins.length) return
    const lines = input.lines.filter(Boolean)
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id, title: input.title, content: lines.join("\n"), type: "WARNING",
        relatedType: input.relatedType, relatedId: input.relatedId,
      })),
    })
    const url = getTelegramPageUrl(input.adminPath)
    const text = [`<b>${escapeHtml(input.title)}</b>`, "", ...lines.map(escapeHtml)].join("\n")
    await Promise.all(admins
      .filter((admin) => admin.telegramId && admin.telegramVerifiedAt)
      .map((admin) => telegramApi("sendMessage", {
        chat_id: admin.telegramId,
        text,
        parse_mode: "HTML",
        ...(url ? { reply_markup: { inline_keyboard: [[{ text: input.buttonText, web_app: { url } }]] } } : {}),
      }).catch((error: unknown) => console.warn("Admin Telegram notice failed", error instanceof Error ? error.message : error))))
  } catch (error) {
    console.warn("Admin notification failed", error instanceof Error ? error.message : error)
  }
}
