import { broadcastFuelDigest } from "@/lib/fuel-digest-broadcast"
import { createTelegramWorkerRoute } from "@/lib/telegram-worker-route"

export const dynamic = "force-dynamic"

/* Проверка ключа, обработка ошибок и ответ — в общей обёртке: этот
   каркас был скопирован дословно в шесть маршрутов фоновых задач. */
export const POST = createTelegramWorkerRoute(
  () => broadcastFuelDigest(),
  { label: "Сводка по топливу в чаты", errorMessage: "Не удалось разослать сводку" },
)
