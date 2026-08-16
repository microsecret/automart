-- Reconciles fields that existed in the production database before the
-- migration history was introduced. This migration is required for a clean,
-- reproducible deployment; production must mark it applied after a zero-diff
-- schema preflight because those objects already exist there.

ALTER TABLE "AuctionListing" ADD COLUMN "manufacturedMonth" TEXT;
ALTER TABLE "AuctionListing" ADD COLUMN "specsOrig" TEXT;

ALTER TABLE "Listing" ADD COLUMN "promoType" TEXT;
ALTER TABLE "Listing" ADD COLUMN "promoUntil" DATETIME;

ALTER TABLE "Part" ADD COLUMN "steeringWheel" TEXT;
ALTER TABLE "Part" ADD COLUMN "ownersCount" INTEGER;
ALTER TABLE "Part" ADD COLUMN "documentsStatus" TEXT;
ALTER TABLE "Part" ADD COLUMN "damageInfo" TEXT;
ALTER TABLE "Part" ADD COLUMN "sellerType" TEXT;
ALTER TABLE "Part" ADD COLUMN "availability" TEXT;
ALTER TABLE "Part" ADD COLUMN "customsCleared" BOOLEAN;
ALTER TABLE "Part" ADD COLUMN "generation" TEXT;
ALTER TABLE "Part" ADD COLUMN "keywords" TEXT;
ALTER TABLE "Part" ADD COLUMN "subcategory" TEXT;
ALTER TABLE "Part" ADD COLUMN "oemNumber" TEXT;
ALTER TABLE "Part" ADD COLUMN "suspensionType" TEXT;
ALTER TABLE "Part" ADD COLUMN "brakeType" TEXT;
ALTER TABLE "Part" ADD COLUMN "vehicleType" TEXT NOT NULL DEFAULT 'CAR';

CREATE TABLE "PartCompatibility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "generation" TEXT,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "engine" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartCompatibility_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "userId" TEXT,
    "newsId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Comment_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "News" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PartCompatibility_partId_idx" ON "PartCompatibility"("partId");
CREATE INDEX "PartCompatibility_make_model_idx" ON "PartCompatibility"("make", "model");

-- Older migrations added database defaults for updatedAt that are not part of
-- the Prisma data model. Recreate only those four tables so a clean migration
-- produces the same schema as production and `prisma migrate diff` is empty.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_AIServiceLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "provider" TEXT,
    "subjectVehicleId" TEXT,
    "inputData" TEXT,
    "resultData" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AIServiceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AIServiceLog" ("createdAt", "id", "inputData", "provider", "resultData", "serviceType", "status", "subjectVehicleId", "updatedAt", "userId") SELECT "createdAt", "id", "inputData", "provider", "resultData", "serviceType", "status", "subjectVehicleId", "updatedAt", "userId" FROM "AIServiceLog";
DROP TABLE "AIServiceLog";
ALTER TABLE "new_AIServiceLog" RENAME TO "AIServiceLog";
CREATE INDEX "AIServiceLog_serviceType_createdAt_idx" ON "AIServiceLog"("serviceType", "createdAt");
CREATE INDEX "AIServiceLog_userId_serviceType_status_createdAt_idx" ON "AIServiceLog"("userId", "serviceType", "status", "createdAt");

CREATE TABLE "new_ExchangeRate" (
    "currency" TEXT NOT NULL PRIMARY KEY,
    "rateToRub" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "effectiveAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ExchangeRate" ("createdAt", "currency", "effectiveAt", "rateToRub", "source", "updatedAt") SELECT "createdAt", "currency", "effectiveAt", "rateToRub", "source", "updatedAt" FROM "ExchangeRate";
DROP TABLE "ExchangeRate";
ALTER TABLE "new_ExchangeRate" RENAME TO "ExchangeRate";
CREATE INDEX "ExchangeRate_updatedAt_idx" ON "ExchangeRate"("updatedAt");

CREATE TABLE "new_ListingReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedAt" DATETIME,
    "reviewerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ListingReport_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListingReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListingReport_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ListingReport" ("comment", "createdAt", "id", "listingId", "reason", "reporterId", "reviewedAt", "reviewerId", "status", "updatedAt") SELECT "comment", "createdAt", "id", "listingId", "reason", "reporterId", "reviewedAt", "reviewerId", "status", "updatedAt" FROM "ListingReport";
DROP TABLE "ListingReport";
ALTER TABLE "new_ListingReport" RENAME TO "ListingReport";
CREATE INDEX "ListingReport_status_createdAt_idx" ON "ListingReport"("status", "createdAt");
CREATE INDEX "ListingReport_reporterId_createdAt_idx" ON "ListingReport"("reporterId", "createdAt");
CREATE UNIQUE INDEX "ListingReport_listingId_reporterId_key" ON "ListingReport"("listingId", "reporterId");

CREATE TABLE "new_News" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "imageUrl" TEXT,
    "sourceUrl" TEXT,
    "telegramUrl" TEXT,
    "sourceKey" TEXT,
    "sourceChannel" TEXT,
    "sourceMessageId" INTEGER,
    "author" TEXT,
    "tags" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_News" ("author", "content", "createdAt", "excerpt", "id", "imageUrl", "publishedAt", "seoDescription", "seoTitle", "slug", "sourceChannel", "sourceKey", "sourceMessageId", "sourceUrl", "tags", "telegramUrl", "title", "updatedAt", "views") SELECT "author", "content", "createdAt", "excerpt", "id", "imageUrl", "publishedAt", "seoDescription", "seoTitle", "slug", "sourceChannel", "sourceKey", "sourceMessageId", "sourceUrl", "tags", "telegramUrl", "title", "updatedAt", "views" FROM "News";
DROP TABLE "News";
ALTER TABLE "new_News" RENAME TO "News";
CREATE UNIQUE INDEX "News_slug_key" ON "News"("slug");
CREATE UNIQUE INDEX "News_sourceKey_key" ON "News"("sourceKey");
CREATE INDEX "News_publishedAt_idx" ON "News"("publishedAt");
CREATE INDEX "News_sourceChannel_sourceMessageId_idx" ON "News"("sourceChannel", "sourceMessageId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
