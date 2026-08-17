-- SQLite stores INTEGER as 64-bit, while Prisma `Int` is 32-bit. Preserve
-- malformed source rows for audit, but make them readable and invisible in
-- the public catalogue before the generated client touches them.
UPDATE "AuctionListing"
SET
  "status" = 'POLICY_EXCLUDED',
  "sourcePrice" = 0,
  "priceRub" = 0,
  "finalPrice" = 0,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "sourcePrice" > 2147483647 OR
  "priceRub" > 2147483647 OR
  "markup" > 2147483647 OR
  "finalPrice" > 2147483647;
