-- Existing password accounts were created before email verification was introduced.
-- Preserve their access; every later password registration starts with emailVerified = NULL.
UPDATE "User"
SET "emailVerified" = CURRENT_TIMESTAMP
WHERE "emailVerified" IS NULL
  AND "email" NOT LIKE 'tg_%@telegram.local';
