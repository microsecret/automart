-- Retain the count of already imported listings hidden by the active import
-- policy, separately from source removals and skipped discovery candidates.
ALTER TABLE "AuctionSyncRun" ADD COLUMN "excludedByPolicy" INTEGER NOT NULL DEFAULT 0;
