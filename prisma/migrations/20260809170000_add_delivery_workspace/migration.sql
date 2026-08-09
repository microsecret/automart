-- CreateTable
CREATE TABLE "DeliveryOrganization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "inn" TEXT NOT NULL,
    "ogrn" TEXT,
    "organizationType" TEXT NOT NULL DEFAULT 'COMPANY',
    "serviceRegions" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationSource" TEXT,
    "fnsCheckedAt" DATETIME,
    "verificationNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryOrganization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'VEHICLE',
    "sourceType" TEXT NOT NULL DEFAULT 'AUCTION',
    "status" TEXT NOT NULL DEFAULT 'REQUEST_CREATED',
    "statusSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "auctionListingId" TEXT,
    "vin" TEXT,
    "lotNumber" TEXT,
    "originCountry" TEXT NOT NULL,
    "originCity" TEXT,
    "originCheckpoint" TEXT,
    "transitCity" TEXT,
    "destinationCity" TEXT NOT NULL,
    "destinationRegion" TEXT,
    "buyerId" TEXT NOT NULL,
    "partnerId" TEXT,
    "managerId" TEXT,
    "buyerDepositAmount" INTEGER,
    "buyerDepositStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
    "depositPaidAt" DATETIME,
    "expectedPurchaseAt" DATETIME,
    "purchasedAt" DATETIME,
    "estimatedDeliveryAt" DATETIME,
    "completedAt" DATETIME,
    "nextAction" TEXT,
    "nextActionAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryOrder_auctionListingId_fkey" FOREIGN KEY ("auctionListingId") REFERENCES "AuctionListing" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DeliveryOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeliveryOrder_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DeliveryOrder_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryOrderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsibleRole" TEXT NOT NULL DEFAULT 'PLATFORM',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "isVisibleToBuyer" BOOLEAN NOT NULL DEFAULT true,
    "expectedAt" DATETIME,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryEvent_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES "DeliveryOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeliveryEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryOrderId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "payeeName" TEXT,
    "invoiceNumber" TEXT,
    "instruction" TEXT,
    "dueAt" DATETIME,
    "paidAt" DATETIME,
    "confirmedAt" DATETIME,
    "receiptDocumentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryPayment_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES "DeliveryOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryOrderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'BUYER_AND_TEAM',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryDocument_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES "DeliveryOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeliveryDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryOrderId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryMessage_deliveryOrderId_fkey" FOREIGN KEY ("deliveryOrderId") REFERENCES "DeliveryOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeliveryMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryOrganization_inn_key" ON "DeliveryOrganization"("inn");
CREATE INDEX "DeliveryOrganization_ownerId_idx" ON "DeliveryOrganization"("ownerId");
CREATE INDEX "DeliveryOrganization_verificationStatus_idx" ON "DeliveryOrganization"("verificationStatus");
CREATE UNIQUE INDEX "DeliveryOrder_code_key" ON "DeliveryOrder"("code");
CREATE INDEX "DeliveryOrder_buyerId_updatedAt_idx" ON "DeliveryOrder"("buyerId", "updatedAt");
CREATE INDEX "DeliveryOrder_partnerId_updatedAt_idx" ON "DeliveryOrder"("partnerId", "updatedAt");
CREATE INDEX "DeliveryOrder_managerId_updatedAt_idx" ON "DeliveryOrder"("managerId", "updatedAt");
CREATE INDEX "DeliveryOrder_status_updatedAt_idx" ON "DeliveryOrder"("status", "updatedAt");
CREATE INDEX "DeliveryOrder_auctionListingId_idx" ON "DeliveryOrder"("auctionListingId");
CREATE INDEX "DeliveryEvent_deliveryOrderId_completedAt_idx" ON "DeliveryEvent"("deliveryOrderId", "completedAt");
CREATE INDEX "DeliveryEvent_status_idx" ON "DeliveryEvent"("status");
CREATE INDEX "DeliveryPayment_deliveryOrderId_status_idx" ON "DeliveryPayment"("deliveryOrderId", "status");
CREATE INDEX "DeliveryPayment_category_idx" ON "DeliveryPayment"("category");
CREATE UNIQUE INDEX "DeliveryDocument_storageKey_key" ON "DeliveryDocument"("storageKey");
CREATE INDEX "DeliveryDocument_deliveryOrderId_createdAt_idx" ON "DeliveryDocument"("deliveryOrderId", "createdAt");
CREATE INDEX "DeliveryDocument_visibility_idx" ON "DeliveryDocument"("visibility");
CREATE INDEX "DeliveryMessage_deliveryOrderId_createdAt_idx" ON "DeliveryMessage"("deliveryOrderId", "createdAt");
