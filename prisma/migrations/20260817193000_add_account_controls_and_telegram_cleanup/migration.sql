ALTER TABLE "User" ADD COLUMN "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "User" ADD COLUMN "restrictionReason" TEXT;
ALTER TABLE "User" ADD COLUMN "statusUpdatedAt" DATETIME;

CREATE TABLE "TelegramMessageCleanup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "deleteAt" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "TelegramMessageCleanup_chatId_messageId_key" ON "TelegramMessageCleanup"("chatId", "messageId");
CREATE INDEX "TelegramMessageCleanup_processedAt_deleteAt_idx" ON "TelegramMessageCleanup"("processedAt", "deleteAt");
