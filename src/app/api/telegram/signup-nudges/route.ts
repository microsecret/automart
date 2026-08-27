import { processSignupNudges } from "@/lib/telegram-signup-nudge"
import { createTelegramWorkerRoute } from "@/lib/telegram-worker-route"

export const dynamic = "force-dynamic"

/* Проверка ключа, обработка ошибок и ответ — в общей обёртке: этот
   каркас был скопирован дословно в шесть маршрутов фоновых задач. */
export const POST = createTelegramWorkerRoute(
  () => processSignupNudges(),
  { label: "Подталкивание молчунов к регистрации", errorMessage: "Не удалось разослать приглашения" },
)
