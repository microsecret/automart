-- Reconcile tables that existed in the application schema before they were
-- represented in migration history. Every statement is idempotent so this is
-- safe for an already populated production database and a fresh install.

CREATE TABLE IF NOT EXISTS "AuctionListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "mileage" INTEGER,
    "fuelType" TEXT,
    "transmission" TEXT,
    "bodyType" TEXT,
    "color" TEXT,
    "engineVolume" REAL,
    "power" INTEGER,
    "driveType" TEXT,
    "vin" TEXT,
    "lotNumber" TEXT,
    "sourcePrice" INTEGER NOT NULL,
    "sourceCurrency" TEXT NOT NULL,
    "priceRub" INTEGER NOT NULL,
    "markup" INTEGER NOT NULL,
    "finalPrice" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "images" TEXT,
    "descriptionOrig" TEXT,
    "descriptionRu" TEXT,
    "specsRu" TEXT,
    "country" TEXT NOT NULL,
    "auctionDate" DATETIME,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isTranslated" BOOLEAN NOT NULL DEFAULT false,
    "translatedAt" DATETIME,
    "lastChecked" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "AuctionListing_source_sourceId_key" ON "AuctionListing"("source", "sourceId");
CREATE INDEX IF NOT EXISTS "AuctionListing_source_idx" ON "AuctionListing"("source");
CREATE INDEX IF NOT EXISTS "AuctionListing_status_idx" ON "AuctionListing"("status");
CREATE INDEX IF NOT EXISTS "AuctionListing_make_model_idx" ON "AuctionListing"("make", "model");
CREATE INDEX IF NOT EXISTS "AuctionListing_country_idx" ON "AuctionListing"("country");
CREATE INDEX IF NOT EXISTS "AuctionListing_auctionDate_idx" ON "AuctionListing"("auctionDate");

CREATE TABLE IF NOT EXISTS "AuctionInquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auctionListingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "managerNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AuctionInquiry_auctionListingId_fkey" FOREIGN KEY ("auctionListingId") REFERENCES "AuctionListing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuctionInquiry_auctionListingId_idx" ON "AuctionInquiry"("auctionListingId");
CREATE INDEX IF NOT EXISTS "AuctionInquiry_status_idx" ON "AuctionInquiry"("status");

-- The next historical migration rebuilds News to its full SEO-ready shape.
CREATE TABLE IF NOT EXISTS "News" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "imageUrl" TEXT,
    "sourceUrl" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
