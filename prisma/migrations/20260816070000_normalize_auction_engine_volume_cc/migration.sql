-- Auction sources use cubic centimetres, while legacy import code stored
-- small values as litres. Normalize existing imported lots once and remove
-- meaningless displacement values from electric vehicles.
UPDATE "AuctionListing"
SET "engineVolume" = NULL
WHERE "fuelType" = 'ELECTRIC';

UPDATE "AuctionListing"
SET "engineVolume" = ROUND("engineVolume" * 1000)
WHERE "engineVolume" > 0
  AND "engineVolume" <= 10
  AND ("fuelType" IS NULL OR "fuelType" <> 'ELECTRIC');
