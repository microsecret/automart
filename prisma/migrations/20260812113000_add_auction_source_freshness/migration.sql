-- Keep source freshness separate from currency repricing. A listing is only
-- hidden after two confirmed "not found" checks, never after a transient
-- network or source-format failure.
ALTER TABLE "AuctionListing" ADD COLUMN "sourceLastSeenAt" DATETIME;
ALTER TABLE "AuctionListing" ADD COLUMN "sourceMissingChecks" INTEGER NOT NULL DEFAULT 0;

UPDATE "AuctionListing"
SET "sourceLastSeenAt" = "lastChecked"
WHERE "sourceLastSeenAt" IS NULL;

CREATE INDEX "AuctionListing_source_status_lastChecked_idx"
  ON "AuctionListing"("source", "status", "lastChecked");
CREATE INDEX "AuctionListing_source_status_sourceLastSeenAt_idx"
  ON "AuctionListing"("source", "status", "sourceLastSeenAt");

CREATE TABLE "AuctionSyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "syncKind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "catalogUrl" TEXT,
    "requestedLimit" INTEGER NOT NULL,
    "discovered" INTEGER NOT NULL DEFAULT 0,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "expired" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

CREATE INDEX "AuctionSyncRun_source_startedAt_idx"
  ON "AuctionSyncRun"("source", "startedAt");
CREATE INDEX "AuctionSyncRun_status_startedAt_idx"
  ON "AuctionSyncRun"("status", "startedAt");
