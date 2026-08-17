-- CreateTable
CREATE TABLE "PartStore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "legalName" TEXT,
    "inn" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "city" TEXT,
    "defaultLeadTimeDaysMin" INTEGER,
    "defaultLeadTimeDaysMax" INTEGER,
    "defaultOriginCountry" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "statusReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartStore_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PartStore_slug_key" ON "PartStore"("slug");

-- CreateIndex
CREATE INDEX "PartStore_ownerId_idx" ON "PartStore"("ownerId");

-- CreateIndex
CREATE INDEX "PartStore_status_idx" ON "PartStore"("status");

-- CreateTable
CREATE TABLE "PartImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "fileName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "errorReport" TEXT,
    "appliedAt" DATETIME,
    "revertedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartImportBatch_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "PartStore" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PartImportBatch_storeId_createdAt_idx" ON "PartImportBatch"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "PartImportBatch_status_idx" ON "PartImportBatch"("status");

-- AlterTable
ALTER TABLE "Part" ADD COLUMN "storeId" TEXT REFERENCES "PartStore" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Part" ADD COLUMN "supplyMode" TEXT NOT NULL DEFAULT 'STOCK';
ALTER TABLE "Part" ADD COLUMN "leadTimeDaysMin" INTEGER;
ALTER TABLE "Part" ADD COLUMN "leadTimeDaysMax" INTEGER;
ALTER TABLE "Part" ADD COLUMN "originCountry" TEXT;
ALTER TABLE "Part" ADD COLUMN "brandName" TEXT;
ALTER TABLE "Part" ADD COLUMN "batchId" TEXT;

-- CreateIndex
CREATE INDEX "Part_storeId_createdAt_idx" ON "Part"("storeId", "createdAt");

-- CreateIndex
CREATE INDEX "Part_batchId_idx" ON "Part"("batchId");

-- CreateIndex
CREATE INDEX "Part_oemNumber_idx" ON "Part"("oemNumber");
