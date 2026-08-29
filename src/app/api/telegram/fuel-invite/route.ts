import { broadcastFuelInvite } from "@/lib/fuel-invite-broadcast"
import { createTelegramWorkerRoute } from "@/lib/telegram-worker-route"

export const dynamic = "force-dynamic"

/* Проверка ключа, обработка ошибок и ответ — в общей обёртке: этот
   каркас был скопирован дословно в шесть маршрутов фоновых задач. */
export const POST = createTelegramWorkerRoute(
  () => broadcastFuelInvite(),
  { label: "Приглашение в карту АЗС", errorMessage: "Не удалось разослать приглашение" },
)
