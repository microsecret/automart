-- A policy skip is a successful, deliberate decision and must not be
-- confused with a source/parser failure in the operational history.
ALTER TABLE "AuctionSyncRun" ADD COLUMN "skippedByPolicy" INTEGER NOT NULL DEFAULT 0;
