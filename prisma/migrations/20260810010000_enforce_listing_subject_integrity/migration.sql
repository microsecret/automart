-- SQLite cannot express an XOR CHECK on two nullable foreign keys through the
-- current Prisma schema. These triggers make the unified listing invariant
-- durable even for direct SQL writes: a listing always references exactly one
-- subject, and deleting a subject also removes its public listing.

CREATE TRIGGER "Listing_require_exactly_one_subject_insert"
BEFORE INSERT ON "Listing"
FOR EACH ROW
WHEN (NEW."vehicleId" IS NULL AND NEW."partId" IS NULL)
  OR (NEW."vehicleId" IS NOT NULL AND NEW."partId" IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'Listing must reference exactly one subject');
END;

CREATE TRIGGER "Listing_require_exactly_one_subject_update"
BEFORE UPDATE OF "vehicleId", "partId" ON "Listing"
FOR EACH ROW
WHEN (NEW."vehicleId" IS NULL AND NEW."partId" IS NULL)
  OR (NEW."vehicleId" IS NOT NULL AND NEW."partId" IS NOT NULL)
BEGIN
  SELECT RAISE(ABORT, 'Listing must reference exactly one subject');
END;

CREATE TRIGGER "Vehicle_delete_linked_listing"
BEFORE DELETE ON "Vehicle"
FOR EACH ROW
BEGIN
  DELETE FROM "Listing" WHERE "vehicleId" = OLD."id";
END;

CREATE TRIGGER "Part_delete_linked_listing"
BEFORE DELETE ON "Part"
FOR EACH ROW
BEGIN
  DELETE FROM "Listing" WHERE "partId" = OLD."id";
END;
