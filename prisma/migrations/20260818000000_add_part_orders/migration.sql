-- CreateTable
CREATE TABLE "PartOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "partId" TEXT,
    "buyerId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "city" TEXT,
    "comment" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "itemName" TEXT NOT NULL,
    "itemPriceRub" INTEGER NOT NULL,
    "itemOemNumber" TEXT,
    "leadTimeDaysMin" INTEGER,
    "leadTimeDaysMax" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "statusReason" TEXT,
    "sellerNotes" TEXT,
    "ipHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "PartStore" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartOrder_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PartOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PartOrder_storeId_status_createdAt_idx" ON "PartOrder"("storeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PartOrder_buyerId_createdAt_idx" ON "PartOrder"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "PartOrder_partId_idx" ON "PartOrder"("partId");
