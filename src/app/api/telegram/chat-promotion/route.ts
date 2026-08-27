import { cleanupExpiredChatPromotions, notifyExpiringChatPromotions, runChatPromotionDelivery } from "@/lib/chat-promotion-delivery"
import { cleanupSoldListingPosts } from "@/lib/listing-chat-autopost"
import { createTelegramWorkerRoute } from "@/lib/telegram-worker-route"

export const dynamic = "force-dynamic"

/**
 * Публикация оплаченных объявлений в сети чатов.
 *
 * Проверка ключа и обработка ошибок — в общей обёртке: маршрут открыт в
 * интернет, а публикация в сотню тысяч подписчиков не то действие,
 * которое можно запустить со стороны.
 */
export const POST = createTelegramWorkerRoute(
  async () => {
    /* Сначала уборка, потом публикация: место закрепа в группе одно, и
       снятый закреп истёкшего размещения освобождает его для нового. */
    const cleaned = await cleanupExpiredChatPromotions()
    /* Бесплатные посты убираются тем же проходом: ловить момент снятия
       объявления в каждом из мест, где его меняют, значит забыть об
       одном из них. */
    const soldRemoved = await cleanupSoldListingPosts()
    const delivered = await runChatPromotionDelivery()
    /* Предупреждение о скором окончании — после публикации: сначала
       делаем оплаченную работу, потом напоминаем о продлении. */
    const warned = await notifyExpiringChatPromotions()

    return { success: true, ...delivered, removed: cleaned.removed, soldRemoved, notified: warned.notified }
  },
  { label: "Публикация продвижения в чатах", errorMessage: "Не удалось выполнить публикацию" },
)
