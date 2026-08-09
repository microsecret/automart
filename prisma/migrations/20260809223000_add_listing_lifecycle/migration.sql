-- Listing lifecycle is deliberately additive. Existing records remain ACTIVE,
-- so a deployment never removes the live catalogue while the moderation queue
-- is introduced. Soft deletion preserves the original evidence and messages.
ALTER TABLE "Listing" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Listing" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "Listing" ADD COLUMN "publishedAt" DATETIME;
ALTER TABLE "Listing" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "Listing" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Listing" ADD COLUMN "lastStatusChangedAt" DATETIME;

CREATE TABLE "ListingStatusEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingStatusEvent_listingId_fkey"
      FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Listing_status_createdAt_idx" ON "Listing"("status", "createdAt");
CREATE INDEX "Listing_userId_status_updatedAt_idx" ON "Listing"("userId", "status", "updatedAt");
CREATE INDEX "Listing_deletedAt_idx" ON "Listing"("deletedAt");
CREATE INDEX "ListingStatusEvent_listingId_createdAt_idx" ON "ListingStatusEvent"("listingId", "createdAt");

-- Early versions of the parts form wrote a Part but not its unified Listing.
-- Preserve these already-public part pages while bringing future submissions
-- through moderation. Vehicles are intentionally excluded: garage vehicles
-- are not public listings.
INSERT INTO "Listing" (
  "id", "title", "description", "price", "status", "userId", "partId",
  "publishedAt", "lastStatusChangedAt", "createdAt", "updatedAt"
)
SELECT
  lower(hex(randomblob(16))), p."name", p."description", p."price", 'ACTIVE', p."userId", p."id",
  p."createdAt", p."updatedAt", p."createdAt", p."updatedAt"
FROM "Part" p
WHERE NOT EXISTS (
  SELECT 1 FROM "Listing" l WHERE l."partId" = p."id"
);
