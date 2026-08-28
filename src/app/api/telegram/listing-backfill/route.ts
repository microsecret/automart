import { backfillListingChatPosts } from "@/lib/listing-chat-backfill"
import { createTelegramWorkerRoute } from "@/lib/telegram-worker-route"

export const dynamic = "force-dynamic"

/* Проверка ключа, обработка ошибок и ответ — в общей обёртке: этот
   каркас был скопирован дословно в шесть маршрутов фоновых задач. */
export const POST = createTelegramWorkerRoute(
  () => backfillListingChatPosts(),
  { label: "Объявления в чаты (досылка)", errorMessage: "Не удалось разослать объявления" },
)
