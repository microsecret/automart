-- Заявка «ищу деталь» и ответы магазинов на неё.
--
-- В разделе запчастей нет ни одной позиции: продавцы ещё не пришли, а
-- покупатели уже заходят и упираются в пустую страницу. Заявка
-- переворачивает порядок — человек описывает нужную деталь, магазины
-- отвечают предложениями.

CREATE TABLE "PartRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partName" TEXT,
    "oemNumber" TEXT,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "vin" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'ANY',
    "comment" TEXT,
    "clarity" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT,
    "contactMethod" TEXT NOT NULL DEFAULT 'PHONE',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "requesterId" TEXT,
    "managerNotes" TEXT,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "PartRequestOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "storeId" TEXT,
    "sellerId" TEXT,
    "price" INTEGER,
    "condition" TEXT,
    "leadTimeDays" INTEGER,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartRequestOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PartRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PartRequestOffer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "PartStore" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PartRequestOffer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Лента заявок в кабинете магазина: свежие сверху, закрытые не мешают.
CREATE INDEX "PartRequest_status_createdAt_idx" ON "PartRequest"("status", "createdAt");
CREATE INDEX "PartRequest_requesterId_createdAt_idx" ON "PartRequest"("requesterId", "createdAt");
-- Поиск заявок по номеру детали: магазин ищет, есть ли спрос на то, что лежит на складе.
CREATE INDEX "PartRequest_oemNumber_idx" ON "PartRequest"("oemNumber");
CREATE INDEX "PartRequest_make_model_idx" ON "PartRequest"("make", "model");

CREATE INDEX "PartRequestOffer_requestId_createdAt_idx" ON "PartRequestOffer"("requestId", "createdAt");
CREATE INDEX "PartRequestOffer_storeId_status_idx" ON "PartRequestOffer"("storeId", "status");
CREATE INDEX "PartRequestOffer_sellerId_createdAt_idx" ON "PartRequestOffer"("sellerId", "createdAt");
