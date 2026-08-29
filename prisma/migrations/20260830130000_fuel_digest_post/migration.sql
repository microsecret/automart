-- Утренняя сводка по топливу, отправленная в чат.
--
-- Нужна, чтобы не слать её дважды в сутки: сводка утренняя, вторая за день
-- ничего не добавляет, а чат превращает в ленту уведомлений.

CREATE TABLE "FuelDigestPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "FuelDigestPost_chatId_publishedAt_idx" ON "FuelDigestPost"("chatId", "publishedAt");
