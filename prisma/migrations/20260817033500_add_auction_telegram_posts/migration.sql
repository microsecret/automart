CREATE TABLE "AuctionTelegramPost" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "auctionListingId" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "messageId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuctionTelegramPost_auctionListingId_fkey"
    FOREIGN KEY ("auctionListingId") REFERENCES "AuctionListing" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AuctionTelegramPost_auctionListingId_chatId_key"
ON "AuctionTelegramPost"("auctionListingId", "chatId");

CREATE INDEX "AuctionTelegramPost_chatId_createdAt_idx"
ON "AuctionTelegramPost"("chatId", "createdAt");

CREATE INDEX "AuctionTelegramPost_createdAt_idx"
ON "AuctionTelegramPost"("createdAt");
