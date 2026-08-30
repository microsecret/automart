-- Живая геолокация водителя рядом с заправкой.
--
-- Человек за рулём не станет открывать карту и заполнять форму — ему
-- некогда. Но он может один раз включить в боте «транслировать
-- геопозицию», и дальше площадка сама поймёт, что он остановился у АЗС.
--
-- Заправка занимает пять-семь минут вместе с очередью. Простоял
-- пятнадцать — точно заправлялся, и спросить его о ценах уместно: он
-- только что видел табло.
--
-- Запись перезаписывается при каждом обновлении точки: это не история
-- перемещений, а короткая память «где он сейчас».
CREATE TABLE "FuelPresence" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "chatId"      TEXT NOT NULL,
  "stationId"   TEXT NOT NULL,
  "stationName" TEXT NOT NULL,
  "latitude"    REAL NOT NULL,
  "longitude"   REAL NOT NULL,
  "arrivedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seenAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "promptedAt"  DATETIME,
  "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   DATETIME NOT NULL
);

CREATE UNIQUE INDEX "FuelPresence_chatId_key" ON "FuelPresence"("chatId");
CREATE INDEX "FuelPresence_seenAt_idx" ON "FuelPresence"("seenAt");
CREATE INDEX "FuelPresence_stationId_seenAt_idx" ON "FuelPresence"("stationId", "seenAt");
