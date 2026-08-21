-- Учёт всех, кто нажал «Начать» в боте.
--
-- Раньше человек, не дошедший до подтверждения телефона, нигде не
-- сохранялся — а именно такие составляют основную аудиторию рассылки.
--
-- Телефон и почта сюда не дублируются: они живут в User и появляются
-- только после регистрации.
CREATE TABLE "TelegramContact" (
    "telegramId" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "registered" BOOLEAN NOT NULL DEFAULT false,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastBroadcastAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "TelegramContact_blocked_registered_idx" ON "TelegramContact"("blocked", "registered");
CREATE INDEX "TelegramContact_lastBroadcastAt_idx" ON "TelegramContact"("lastBroadcastAt");
