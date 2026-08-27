import { processDueTelegramMessageCleanup } from "@/lib/telegram-message-cleanup"
import { createTelegramWorkerRoute } from "@/lib/telegram-worker-route"

export const dynamic = "force-dynamic"

/* Проверка ключа, обработка ошибок и ответ — в общей обёртке: этот
   каркас был скопирован дословно в шесть маршрутов фоновых задач. */
export const POST = createTelegramWorkerRoute(
  async () => ({ ok: true, ...(await processDueTelegramMessageCleanup()) }),
  { label: "Уборка служебных сообщений бота", errorMessage: "Не удалось убрать сообщения" },
)
