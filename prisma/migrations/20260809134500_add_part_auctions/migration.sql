ALTER TABLE "Part" ADD COLUMN "saleFormat" TEXT NOT NULL DEFAULT 'FIXED';
ALTER TABLE "Part" ADD COLUMN "auctionStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Part" ADD COLUMN "auctionEndsAt" DATETIME;
ALTER TABLE "Part" ADD COLUMN "auctionStartPrice" INTEGER;
ALTER TABLE "Part" ADD COLUMN "auctionCurrentPrice" INTEGER;
ALTER TABLE "Part" ADD COLUMN "auctionMinStep" INTEGER;

CREATE TABLE "PartBid" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" INTEGER NOT NULL,
    "partId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartBid_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartBid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PartBid_partId_createdAt_idx" ON "PartBid"("partId", "createdAt");
CREATE INDEX "PartBid_userId_createdAt_idx" ON "PartBid"("userId", "createdAt");
