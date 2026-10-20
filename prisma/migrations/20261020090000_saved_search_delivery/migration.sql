ALTER TABLE "SavedSearch" ADD COLUMN "lastCheckedAt" DATETIME;
CREATE INDEX "SavedSearch_notifyTelegram_lastCheckedAt_idx" ON "SavedSearch"("notifyTelegram", "lastCheckedAt");
CREATE TABLE "SavedSearchDelivery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "searchId" TEXT NOT NULL,
  "windowStart" DATETIME NOT NULL,
  "windowEnd" DATETIME NOT NULL,
  "matchCount" INTEGER NOT NULL,
  "telegramStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedSearchDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SavedSearchDelivery_searchId_windowStart_key" ON "SavedSearchDelivery"("searchId", "windowStart");
CREATE INDEX "SavedSearchDelivery_userId_createdAt_idx" ON "SavedSearchDelivery"("userId", "createdAt");
