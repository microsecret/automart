-- Сведения о товаре и продавце по закону о защите прав потребителей и техрегламентам ЕАЭС.
ALTER TABLE "Part" ADD COLUMN "gtin" TEXT;
ALTER TABLE "Part" ADD COLUMN "manufacturerInfo" TEXT;
ALTER TABLE "Part" ADD COLUMN "warrantyMonths" INTEGER;
ALTER TABLE "Part" ADD COLUMN "shelfLife" TEXT;
ALTER TABLE "Part" ADD COLUMN "safetyInfo" TEXT;
ALTER TABLE "Part" ADD COLUMN "conformityType" TEXT;
ALTER TABLE "Part" ADD COLUMN "conformityRegulation" TEXT;
ALTER TABLE "Part" ADD COLUMN "conformityNumber" TEXT;
ALTER TABLE "Part" ADD COLUMN "conformityValidUntil" DATETIME;
ALTER TABLE "Part" ADD COLUMN "conformityUrl" TEXT;
ALTER TABLE "PartStore" ADD COLUMN "ogrn" TEXT;
ALTER TABLE "PartStore" ADD COLUMN "legalAddress" TEXT;
ALTER TABLE "PartStore" ADD COLUMN "sellerType" TEXT;
