-- Учёт сообщений о появлении топлива в городских чатах.
--
-- Нужен, чтобы не слать в чат одно и то же по десять раз: в дефицит на
-- одну колонку приходит пачка отметок от очереди, где каждый второй
-- отмечает то же самое.
CREATE TABLE "FuelChatPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "fuels" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "FuelChatPost_chatId_stationId_createdAt_idx" ON "FuelChatPost"("chatId", "stationId", "createdAt");
CREATE INDEX "FuelChatPost_chatId_createdAt_idx" ON "FuelChatPost"("chatId", "createdAt");
