import { processPromotionNudges } from "@/lib/promotion-nudge"
import { createTelegramWorkerRoute } from "@/lib/telegram-worker-route"

export const dynamic = "force-dynamic"

/* Проверка ключа, обработка ошибок и ответ — в общей обёртке: этот
   каркас был скопирован дословно в шесть маршрутов фоновых задач. */
export const POST = createTelegramWorkerRoute(
  () => processPromotionNudges(),
  { label: "Напоминания о продвижении", errorMessage: "Не удалось разослать напоминания" },
)
