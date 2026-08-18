-- CreateTable
CREATE TABLE "ReferralAttribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralAttribution_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReferralAttribution_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralAttribution_inviteeId_key" ON "ReferralAttribution"("inviteeId");

-- CreateIndex
CREATE INDEX "ReferralAttribution_partnerId_createdAt_idx" ON "ReferralAttribution"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralAttribution_code_idx" ON "ReferralAttribution"("code");

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "promotionOrderId" TEXT NOT NULL,
    "orderAmountRub" INTEGER NOT NULL,
    "percent" INTEGER NOT NULL,
    "amountRub" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACCRUED',
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralReward_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_promotionOrderId_key" ON "ReferralReward"("promotionOrderId");

-- CreateIndex
CREATE INDEX "ReferralReward_partnerId_status_createdAt_idx" ON "ReferralReward"("partnerId", "status", "createdAt");

-- CreateTable
CREATE TABLE "ReferralPayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerId" TEXT NOT NULL,
    "amountRub" INTEGER NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "comment" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralPayout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReferralPayout_partnerId_createdAt_idx" ON "ReferralPayout"("partnerId", "createdAt");
