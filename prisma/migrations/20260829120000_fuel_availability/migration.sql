-- Наличие топлива на АЗС по отметкам водителей.
--
-- Цена на карте была, а наличия не было — и в дефицит именно оно решает,
-- ехать ли на заправку. Отдельная таблица, а не поле в FuelPriceReport:
-- у наличия своя жизнь, оно живёт часами и отмечается в разы чаще цены.

CREATE TABLE "FuelAvailabilityReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stationId" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "fuel" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "queue" TEXT,
    "userId" TEXT,
    "ipHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FuelAvailabilityReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Сводка читает свежие отметки по точке — этот порядок и нужен индексу.
CREATE INDEX "FuelAvailabilityReport_stationId_createdAt_idx" ON "FuelAvailabilityReport"("stationId", "createdAt");
CREATE INDEX "FuelAvailabilityReport_userId_createdAt_idx" ON "FuelAvailabilityReport"("userId", "createdAt");
