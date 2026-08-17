-- AlterTable
ALTER TABLE "DeliveryOrganization" ADD COLUMN "slaResponseMinutes" INTEGER;
ALTER TABLE "DeliveryOrganization" ADD COLUMN "slaAcceptedOffers" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DeliveryOrganization" ADD COLUMN "slaMissedOffers" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DeliveryOrganization" ADD COLUMN "slaClosedDeals" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DeliveryOrganization" ADD COLUMN "slaRating" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DeliveryOrganization" ADD COLUMN "slaUpdatedAt" DATETIME;

-- CreateIndex
CREATE INDEX "DeliveryOrganization_verificationStatus_slaRating_idx" ON "DeliveryOrganization"("verificationStatus", "slaRating");
