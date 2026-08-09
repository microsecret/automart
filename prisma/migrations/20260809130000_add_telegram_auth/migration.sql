-- Telegram identity and phone login fields.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramId" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramUsername" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramVerifiedAt" DATETIME;

CREATE TABLE "TelegramAuthCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
CREATE INDEX "TelegramAuthCode_phone_purpose_createdAt_idx" ON "TelegramAuthCode"("phone", "purpose", "createdAt");
CREATE INDEX "TelegramAuthCode_expiresAt_idx" ON "TelegramAuthCode"("expiresAt");
