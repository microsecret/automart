-- Еженедельное письмо в боте: отметка отправки, отписка и личный код
-- приглашения для контактов без аккаунта на сайте.
ALTER TABLE "TelegramContact" ADD COLUMN "lastWeeklyAt" DATETIME;
ALTER TABLE "TelegramContact" ADD COLUMN "weeklyOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TelegramContact" ADD COLUMN "referralCode" TEXT;

CREATE UNIQUE INDEX "TelegramContact_referralCode_key" ON "TelegramContact"("referralCode");
CREATE INDEX "TelegramContact_blocked_weeklyOptOut_lastWeeklyAt_idx" ON "TelegramContact"("blocked", "weeklyOptOut", "lastWeeklyAt");
