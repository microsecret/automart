CREATE TABLE "ListingViewEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingViewEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListingViewEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ListingViewEvent_listingId_createdAt_idx" ON "ListingViewEvent"("listingId", "createdAt");
CREATE INDEX "ListingViewEvent_ipHash_createdAt_idx" ON "ListingViewEvent"("ipHash", "createdAt");
CREATE INDEX "ListingViewEvent_userId_createdAt_idx" ON "ListingViewEvent"("userId", "createdAt");
