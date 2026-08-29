-- Приглашение в карту АЗС, отправленное в чат.
--
-- Карта наличия работает ровно настолько, насколько людей на ней, а о ней
-- не узнают: на сайт заходят единицы. Запись нужна, чтобы не звать один и
-- тот же чат чаще, чем раз в трое суток.

CREATE TABLE "FuelInvitePost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "FuelInvitePost_chatId_publishedAt_idx" ON "FuelInvitePost"("chatId", "publishedAt");
