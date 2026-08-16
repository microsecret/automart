ALTER TABLE "VisitEvent" ADD COLUMN "visitorKey" TEXT;
ALTER TABLE "VisitEvent" ADD COLUMN "deviceType" TEXT;
ALTER TABLE "VisitEvent" ADD COLUMN "trafficSource" TEXT;
ALTER TABLE "VisitEvent" ADD COLUMN "campaign" TEXT;

CREATE INDEX "VisitEvent_visitorKey_createdAt_idx" ON "VisitEvent"("visitorKey", "createdAt");
CREATE INDEX "VisitEvent_deviceType_createdAt_idx" ON "VisitEvent"("deviceType", "createdAt");
CREATE INDEX "VisitEvent_trafficSource_createdAt_idx" ON "VisitEvent"("trafficSource", "createdAt");
