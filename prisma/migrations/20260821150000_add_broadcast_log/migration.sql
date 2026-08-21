-- Журнал массовых рассылок.
--
-- Рассылку нельзя отозвать: без записи невозможно ни подтвердить факт
-- отправки, ни разобрать жалобу, ни понять, после какого письма люди
-- начали блокировать бота.
CREATE TABLE "TelegramBroadcast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "delivered" INTEGER NOT NULL,
    "blocked" INTEGER NOT NULL,
    "failed" INTEGER NOT NULL,
    "sentById" TEXT,
    "sentByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "TelegramBroadcast_createdAt_idx" ON "TelegramBroadcast"("createdAt");
