-- The category-identity migration rebuilds the SQLite Vehicle table, which
-- intentionally drops database triggers. Restore the listing cascade and
-- normalize only deterministic seed/demo VINs; real user identifiers are
-- never rewritten by this migration.

CREATE TRIGGER IF NOT EXISTS "Vehicle_delete_linked_listing"
BEFORE DELETE ON "Vehicle"
FOR EACH ROW
BEGIN
  DELETE FROM "Listing" WHERE "vehicleId" = OLD."id";
END;

-- Seed records used DEMO-prefixed placeholders before VIN validation existed.
-- A `D` plus the first 16 hexadecimal characters of the immutable UUID is a
-- unique, deterministic 17-character placeholder without VIN-forbidden I/O/Q.
UPDATE "Vehicle"
SET "vin" = 'D' || UPPER(SUBSTR(REPLACE("id", '-', ''), 1, 16))
WHERE "vehicleType" IN ('CAR', 'MOTORCYCLE', 'TRUCK')
  AND "vin" GLOB 'DEMO*';
