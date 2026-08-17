CREATE TABLE "AuctionInquiryOffer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "inquiryId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OFFERED',
  "matchScore" INTEGER NOT NULL DEFAULT 0,
  "matchReason" TEXT,
  "expiresAt" DATETIME NOT NULL,
  "respondedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuctionInquiryOffer_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "AuctionInquiry" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AuctionInquiryOffer_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AuctionInquiryOffer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "DeliveryOrganization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AuctionInquiryOffer_inquiryId_partnerId_key" ON "AuctionInquiryOffer"("inquiryId", "partnerId");
CREATE INDEX "AuctionInquiryOffer_partnerId_status_expiresAt_idx" ON "AuctionInquiryOffer"("partnerId", "status", "expiresAt");
CREATE INDEX "AuctionInquiryOffer_inquiryId_status_idx" ON "AuctionInquiryOffer"("inquiryId", "status");
CREATE INDEX "AuctionInquiryOffer_organizationId_status_idx" ON "AuctionInquiryOffer"("organizationId", "status");
