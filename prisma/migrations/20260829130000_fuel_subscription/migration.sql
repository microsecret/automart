-- Подписка на появление топлива.
--
-- Отметки отвечают «есть ли сейчас», а человеку с пустым баком нужно знать,
-- когда появится: иначе он открывает карту двадцать раз за день или не
-- открывает вовсе.

CREATE TABLE "FuelSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stationId" TEXT,
    "stationName" TEXT,
    "fuel" TEXT,
    "city" TEXT,
    "lastNotifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FuelSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Рассылка ищет подписки по точке и по городу — оба пути нужны индексу.
CREATE INDEX "FuelSubscription_stationId_fuel_idx" ON "FuelSubscription"("stationId", "fuel");
CREATE INDEX "FuelSubscription_city_fuel_idx" ON "FuelSubscription"("city", "fuel");
CREATE INDEX "FuelSubscription_userId_createdAt_idx" ON "FuelSubscription"("userId", "createdAt");
