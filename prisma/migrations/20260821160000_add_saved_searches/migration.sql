-- Сохранённые поиски с уведомлениями о новых лотах.
--
-- Человек редко покупает машину в первый визит: он присматривается неделями.
-- Без подписки ему приходится возвращаться и проверять каталог вручную — и
-- чаще всего он просто не возвращается.
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'LISTINGS',
    "query" TEXT NOT NULL,
    "notifyTelegram" BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedAt" DATETIME,
    "lastMatchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SavedSearch_userId_createdAt_idx" ON "SavedSearch"("userId", "createdAt");
CREATE INDEX "SavedSearch_notifyTelegram_lastNotifiedAt_idx" ON "SavedSearch"("notifyTelegram", "lastNotifiedAt");
