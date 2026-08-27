import { processTelegramMarketingCampaign } from "@/lib/telegram-marketing"
import { createTelegramWorkerRoute } from "@/lib/telegram-worker-route"

export const dynamic = "force-dynamic"

/* Проверка ключа, обработка ошибок и ответ — в общей обёртке: этот
   каркас был скопирован дословно в шесть маршрутов фоновых задач. */
export const POST = createTelegramWorkerRoute(
  () => processTelegramMarketingCampaign(),
  { label: "Рекламная рассылка в чаты", errorMessage: "Не удалось выполнить рассылку" },
)
