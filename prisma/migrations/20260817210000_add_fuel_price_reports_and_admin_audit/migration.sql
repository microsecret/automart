-- CreateTable
CREATE TABLE "FuelPriceReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stationId" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "fuel" TEXT NOT NULL,
    "priceRub" INTEGER NOT NULL,
    "userId" TEXT,
    "ipHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rejectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FuelPriceReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FuelPriceReport_stationId_fuel_createdAt_idx" ON "FuelPriceReport"("stationId", "fuel", "createdAt");

-- CreateIndex
CREATE INDEX "FuelPriceReport_status_createdAt_idx" ON "FuelPriceReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FuelPriceReport_userId_createdAt_idx" ON "FuelPriceReport"("userId", "createdAt");

-- CreateTable
CREATE TABLE "AdminAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdminAuditEvent_createdAt_idx" ON "AdminAuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_actorId_createdAt_idx" ON "AdminAuditEvent"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_entityType_entityId_createdAt_idx" ON "AdminAuditEvent"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_action_createdAt_idx" ON "AdminAuditEvent"("action", "createdAt");
