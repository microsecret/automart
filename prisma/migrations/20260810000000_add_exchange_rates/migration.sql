-- Persist official exchange-rate snapshots separately from auction lots.
-- Existing auction data is preserved; new nullable snapshot fields are filled
-- by scripts/refresh-auction-rates.mjs after deployment.

ALTER TABLE "AuctionListing" ADD COLUMN "exchangeRate" REAL;
ALTER TABLE "AuctionListing" ADD COLUMN "pricingUpdatedAt" DATETIME;

CREATE TABLE "ExchangeRate" (
    "currency" TEXT NOT NULL PRIMARY KEY,
    "rateToRub" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "effectiveAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ExchangeRate_updatedAt_idx" ON "ExchangeRate"("updatedAt");
