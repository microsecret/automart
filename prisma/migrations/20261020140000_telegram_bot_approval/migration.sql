CREATE TABLE "TelegramBotApproval" (
    "chatId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("chatId", "botId")
);
