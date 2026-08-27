-- Публикации объявлений в сети Telegram-чатов.
--
-- Продвижение в чатах оставляет следы вне площадки: пост в чужой ленте и
-- закреп, занимающий единственное место закрепа в группе. Каждая
-- публикация записывается, иначе по истечении оплаченного срока нечем
-- снять закреп и удалить сообщение.

CREATE TABLE "ChatPromotionPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    CONSTRAINT "ChatPromotionPost_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PromotionOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ChatPromotionPost_orderId_publishedAt_idx" ON "ChatPromotionPost"("orderId", "publishedAt");
CREATE INDEX "ChatPromotionPost_chatId_publishedAt_idx" ON "ChatPromotionPost"("chatId", "publishedAt");
CREATE INDEX "ChatPromotionPost_removedAt_idx" ON "ChatPromotionPost"("removedAt");
