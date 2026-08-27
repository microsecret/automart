import { processSavedSearchNotifications } from "@/lib/saved-search-notify"
import { createTelegramWorkerRoute } from "@/lib/telegram-worker-route"

export const dynamic = "force-dynamic"

/* Проверка ключа, обработка ошибок и ответ — в общей обёртке: этот
   каркас был скопирован дословно в шесть маршрутов фоновых задач. */
export const POST = createTelegramWorkerRoute(
  () => processSavedSearchNotifications(),
  { label: "Уведомления по сохранённым поискам", errorMessage: "Не удалось разослать уведомления" },
)
