CREATE TABLE "PromotionOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tariffId" TEXT NOT NULL,
    "amountRub" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'STRIPE',
    "providerCheckoutId" TEXT,
    "providerPaymentId" TEXT,
    "promoUntil" DATETIME,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PromotionOrder_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromotionOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PromotionOrder_providerCheckoutId_key" ON "PromotionOrder"("providerCheckoutId");
CREATE UNIQUE INDEX "PromotionOrder_providerPaymentId_key" ON "PromotionOrder"("providerPaymentId");
CREATE INDEX "PromotionOrder_status_createdAt_idx" ON "PromotionOrder"("status", "createdAt");
CREATE INDEX "PromotionOrder_userId_createdAt_idx" ON "PromotionOrder"("userId", "createdAt");
CREATE INDEX "PromotionOrder_listingId_createdAt_idx" ON "PromotionOrder"("listingId", "createdAt");
