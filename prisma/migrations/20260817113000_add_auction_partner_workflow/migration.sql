-- Link authenticated auction inquiries to a verified partner and the existing
-- delivery workspace. Contact fields remain on AuctionInquiry and therefore
-- stay inside the administrator-only API.
ALTER TABLE "AuctionInquiry" ADD COLUMN "requesterId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuctionInquiry" ADD COLUMN "assignedPartnerId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuctionInquiry" ADD COLUMN "assignedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuctionInquiry" ADD COLUMN "assignedAt" DATETIME;
ALTER TABLE "AuctionInquiry" ADD COLUMN "deliveryOrderId" TEXT REFERENCES "DeliveryOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuctionInquiry" ADD COLUMN "monetizationModel" TEXT NOT NULL DEFAULT 'DEAL_FEE';
ALTER TABLE "AuctionInquiry" ADD COLUMN "platformFeeAmount" INTEGER;
ALTER TABLE "AuctionInquiry" ADD COLUMN "buyerDepositAmount" INTEGER;
ALTER TABLE "AuctionInquiry" ADD COLUMN "startedAt" DATETIME;
ALTER TABLE "AuctionInquiry" ADD COLUMN "closedAt" DATETIME;

ALTER TABLE "DeliveryOrder" ADD COLUMN "monetizationModel" TEXT NOT NULL DEFAULT 'DEAL_FEE';
ALTER TABLE "DeliveryOrder" ADD COLUMN "platformFeeAmount" INTEGER;
ALTER TABLE "DeliveryOrder" ADD COLUMN "platformFeeStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED';

CREATE UNIQUE INDEX "AuctionInquiry_deliveryOrderId_key" ON "AuctionInquiry"("deliveryOrderId");
CREATE INDEX "AuctionInquiry_requesterId_createdAt_idx" ON "AuctionInquiry"("requesterId", "createdAt");
CREATE INDEX "AuctionInquiry_assignedPartnerId_status_idx" ON "AuctionInquiry"("assignedPartnerId", "status");

CREATE TABLE "CommunicationModerationEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "deliveryOrderId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "decision" TEXT NOT NULL DEFAULT 'BLOCKED',
  "reasonCodes" TEXT NOT NULL,
  "redactedPreview" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'LOCAL_POLICY',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationModerationEvent_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES "DeliveryOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommunicationModerationEvent_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CommunicationModerationEvent_deliveryOrderId_createdAt_idx" ON "CommunicationModerationEvent"("deliveryOrderId", "createdAt");
CREATE INDEX "CommunicationModerationEvent_senderId_createdAt_idx" ON "CommunicationModerationEvent"("senderId", "createdAt");
CREATE INDEX "CommunicationModerationEvent_decision_createdAt_idx" ON "CommunicationModerationEvent"("decision", "createdAt");
