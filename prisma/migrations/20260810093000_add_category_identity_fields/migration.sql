-- Category-specific transport identifiers. Road vehicles retain the unique VIN,
-- while special equipment, vessels and aircraft no longer need a fictitious VIN.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "mileage" INTEGER,
    "operatingHours" INTEGER,
    "flightHours" INTEGER,
    "vin" TEXT,
    "serialNumber" TEXT,
    "registrationNumber" TEXT,
    "fuelType" TEXT NOT NULL,
    "transmission" TEXT NOT NULL,
    "bodyType" TEXT,
    "color" TEXT,
    "doors" INTEGER,
    "engineVolume" REAL,
    "power" INTEGER,
    "driveType" TEXT,
    "condition" TEXT NOT NULL,
    "steeringWheel" TEXT,
    "ownersCount" INTEGER,
    "documentsStatus" TEXT,
    "damageInfo" TEXT,
    "sellerType" TEXT,
    "availability" TEXT,
    "customsCleared" BOOLEAN,
    "generation" TEXT,
    "keywords" TEXT,
    "vehicleType" TEXT NOT NULL DEFAULT 'CAR',
    "typeDetails" TEXT,
    "location" TEXT NOT NULL,
    "lat" REAL,
    "lng" REAL,
    "description" TEXT,
    "images" TEXT,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Vehicle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Vehicle" (
  "id", "make", "model", "year", "price", "mileage", "operatingHours", "flightHours", "vin", "serialNumber", "registrationNumber",
  "fuelType", "transmission", "bodyType", "color", "doors", "engineVolume", "power", "driveType",
  "condition", "steeringWheel", "ownersCount", "documentsStatus", "damageInfo", "sellerType",
  "availability", "customsCleared", "generation", "keywords", "vehicleType", "typeDetails", "location",
  "lat", "lng", "description", "images", "userId", "categoryId", "createdAt", "updatedAt"
)
SELECT
  "id", "make", "model", "year", "price", "mileage", "operatingHours", "flightHours", "vin",
  CASE WHEN "vehicleType" = 'SPECIAL' THEN "vin" ELSE NULL END,
  CASE WHEN "vehicleType" IN ('WATER', 'AIR') THEN "vin" ELSE NULL END,
  "fuelType", "transmission", "bodyType", "color", "doors", "engineVolume", "power", "driveType",
  "condition", "steeringWheel", "ownersCount", "documentsStatus", "damageInfo", "sellerType",
  "availability", "customsCleared", "generation", "keywords", "vehicleType", "typeDetails", "location",
  "lat", "lng", "description", "images", "userId", "categoryId", "createdAt", "updatedAt"
FROM "Vehicle";

DROP TABLE "Vehicle";
ALTER TABLE "new_Vehicle" RENAME TO "Vehicle";

CREATE UNIQUE INDEX "Vehicle_vin_key" ON "Vehicle"("vin");
CREATE INDEX "Vehicle_make_model_idx" ON "Vehicle"("make", "model");
CREATE INDEX "Vehicle_year_idx" ON "Vehicle"("year");
CREATE INDEX "Vehicle_price_idx" ON "Vehicle"("price");
CREATE INDEX "Vehicle_location_idx" ON "Vehicle"("location");
CREATE INDEX "Vehicle_vin_idx" ON "Vehicle"("vin");
CREATE INDEX "Vehicle_serialNumber_idx" ON "Vehicle"("serialNumber");
CREATE INDEX "Vehicle_registrationNumber_idx" ON "Vehicle"("registrationNumber");

PRAGMA foreign_keys=ON;
