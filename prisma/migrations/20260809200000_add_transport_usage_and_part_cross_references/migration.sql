-- Category-specific operating metrics. Road mileage remains unchanged;
-- equipment/water use engine hours and aircraft use flight hours.
ALTER TABLE "Vehicle" ADD COLUMN "operatingHours" INTEGER;
ALTER TABLE "Vehicle" ADD COLUMN "flightHours" INTEGER;

-- OEM replacements and analogues are searchable independently of the primary
-- part number, including a punctuation-free normalized representation.
CREATE TABLE "PartCrossReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "normalizedNumber" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PartCrossReference_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PartCrossReference_partId_normalizedNumber_key" ON "PartCrossReference"("partId", "normalizedNumber");
CREATE INDEX "PartCrossReference_normalizedNumber_idx" ON "PartCrossReference"("normalizedNumber");
