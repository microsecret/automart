-- Preserve the exact history of seller edits and prevent the same transport
-- unit or part from having two live marketplace cards at once.
CREATE TABLE "ListingRevision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "listingId" TEXT NOT NULL,
  "actorId" TEXT,
  "changedFields" TEXT NOT NULL,
  "before" TEXT NOT NULL,
  "after" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListingRevision_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ListingRevision_listingId_createdAt_idx"
  ON "ListingRevision" ("listingId", "createdAt");

CREATE UNIQUE INDEX "Listing_live_vehicle_subject_key"
  ON "Listing" ("vehicleId")
  WHERE "vehicleId" IS NOT NULL AND "deletedAt" IS NULL AND "status" <> 'ARCHIVED';

CREATE UNIQUE INDEX "Listing_live_part_subject_key"
  ON "Listing" ("partId")
  WHERE "partId" IS NOT NULL AND "deletedAt" IS NULL AND "status" <> 'ARCHIVED';
