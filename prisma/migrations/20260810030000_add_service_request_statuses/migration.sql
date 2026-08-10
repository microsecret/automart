-- Service results must be auditable: a preliminary valuation can complete
-- automatically while a history check stays an explicit request until an
-- authorised data provider is connected.
ALTER TABLE "AIServiceLog" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE "AIServiceLog" ADD COLUMN "provider" TEXT;
ALTER TABLE "AIServiceLog" ADD COLUMN "subjectVehicleId" TEXT;
ALTER TABLE "AIServiceLog" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "AIServiceLog_userId_serviceType_status_createdAt_idx"
  ON "AIServiceLog"("userId", "serviceType", "status", "createdAt");
