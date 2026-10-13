-- Общий номер оформления корзины из нескольких магазинов.
ALTER TABLE "PartOrder" ADD COLUMN "checkoutId" TEXT;
CREATE INDEX "PartOrder_checkoutId_idx" ON "PartOrder"("checkoutId");
