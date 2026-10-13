-- Характеристики товаров и товарная группа позиции.
ALTER TABLE "Part" ADD COLUMN "productGroup" TEXT;
CREATE INDEX "Part_productGroup_idx" ON "Part"("productGroup");

CREATE TABLE "PartAttribute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "num" REAL,
    "text" TEXT,
    CONSTRAINT "PartAttribute_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PartAttribute_partId_key_key" ON "PartAttribute"("partId", "key");
CREATE INDEX "PartAttribute_key_num_idx" ON "PartAttribute"("key", "num");
CREATE INDEX "PartAttribute_key_text_idx" ON "PartAttribute"("key", "text");
