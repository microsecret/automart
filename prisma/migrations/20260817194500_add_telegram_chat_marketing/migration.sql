CREATE TABLE "TelegramChat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "marketingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPromoAt" DATETIME,
    "lastPromoMessage" INTEGER,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "TelegramChat_active_marketingEnabled_lastPromoAt_idx" ON "TelegramChat"("active", "marketingEnabled", "lastPromoAt");
CREATE INDEX "TelegramChat_lastSeenAt_idx" ON "TelegramChat"("lastSeenAt");

ALTER TABLE "AuctionListing" ADD COLUMN "adminHiddenAt" DATETIME;
ALTER TABLE "AuctionListing" ADD COLUMN "adminHiddenReason" TEXT;
CREATE INDEX "AuctionListing_adminHiddenAt_idx" ON "AuctionListing"("adminHiddenAt");
