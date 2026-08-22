-- История изменения цены объявления.
--
-- Покупатель принимает решение не только по самой цене, но и по её движению:
-- «снижена на 50 000 три дня назад» говорит о готовности торговаться.
CREATE TABLE "ListingPriceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "oldPrice" INTEGER NOT NULL,
    "newPrice" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ListingPriceEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ListingPriceEvent_listingId_createdAt_idx" ON "ListingPriceEvent"("listingId", "createdAt");
