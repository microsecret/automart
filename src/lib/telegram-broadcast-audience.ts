/**
 * Отбор получателей рассылки.
 *
 * Вынесено из telegram-broadcast: там Prisma и сеть, а здесь чистое условие,
 * от которого зависит, кому уйдёт сообщение. Ошибка означает либо рассылку не
 * той аудитории, либо отправку заблокировавшим бота — и жалобы на спам.
 */

export type BroadcastAudience = "all" | "unregistered" | "registered"

export const BROADCAST_AUDIENCES: BroadcastAudience[] = ["all", "unregistered", "registered"]

export function audienceWhere(audience: BroadcastAudience) {
  // Заблокировавшие бота исключаются всегда: Telegram вернёт ошибку, а очередь
  // будет копить отказы.
  const base = { blocked: false }
  if (audience === "registered") return { ...base, registered: true }
  if (audience === "unregistered") return { ...base, registered: false }
  return base
}
