-- Импортированные АЗС, цены и журнал прогонов скрейпера.
--
-- Справочник точек на карте живёт в OpenStreetMap и приезжает живым
-- запросом, поэтому импортированные точки хранятся отдельно: их нельзя
-- подмешать в OSM, но они дают цены и наличие там, где своих отметок ещё
-- нет. Ключ — внешний идентификатор точки (у ГдеБЕНЗ это OSM id), чтобы
-- повторный прогон обновлял запись, а не плодил копии.
CREATE TABLE "FuelStationImport" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "source"    TEXT NOT NULL DEFAULT 'GDEBENZ',
  "sourceId"  TEXT NOT NULL,
  "name"      TEXT,
  "brand"     TEXT,
  "address"   TEXT,
  "city"      TEXT,
  "latitude"  REAL NOT NULL,
  "longitude" REAL NOT NULL,
  "status"    TEXT,
  "fuelsNow"  TEXT,
  "dtOnly"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "FuelStationImport_source_sourceId_key" ON "FuelStationImport"("source", "sourceId");
CREATE INDEX "FuelStationImport_city_idx" ON "FuelStationImport"("city");
CREATE INDEX "FuelStationImport_source_idx" ON "FuelStationImport"("source");

-- Цена марки на импортированной точке, в копейках.
CREATE TABLE "FuelPriceImport" (
  "id"            TEXT NOT NULL PRIMARY KEY,
  "stationId"     TEXT NOT NULL,
  "fuel"          TEXT NOT NULL,
  "priceRub"      INTEGER NOT NULL,
  "confirmations" INTEGER NOT NULL DEFAULT 0,
  "observedAt"    DATETIME,
  "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FuelPriceImport_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "FuelStationImport" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FuelPriceImport_stationId_fuel_key" ON "FuelPriceImport"("stationId", "fuel");
CREATE INDEX "FuelPriceImport_fuel_idx" ON "FuelPriceImport"("fuel");

-- Журнал прогонов скрейсера АЗС.
CREATE TABLE "FuelImportRun" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "source"      TEXT NOT NULL DEFAULT 'GDEBENZ',
  "status"      TEXT NOT NULL DEFAULT 'RUNNING',
  "requested"   INTEGER NOT NULL DEFAULT 0,
  "fetched"     INTEGER NOT NULL DEFAULT 0,
  "upserted"    INTEGER NOT NULL DEFAULT 0,
  "failed"      INTEGER NOT NULL DEFAULT 0,
  "error"       TEXT,
  "startedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME
);

CREATE INDEX "FuelImportRun_source_startedAt_idx" ON "FuelImportRun"("source", "startedAt");
