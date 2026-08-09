-- Create the canonical category records. Reassigning live data happens in the
-- idempotent server reconciliation step after the Prisma schema is synced:
-- older installations have the vehicleType column from db push, while a clean
-- migration history does not contain it yet.
INSERT OR IGNORE INTO "Category" ("id", "name", "description", "icon", "vehicleCount", "createdAt", "updatedAt") VALUES
  (lower(hex(randomblob(16))), 'Легковые автомобили', 'Легковые автомобили и кроссоверы', 'Car', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(16))), 'Мототехника', 'Мотоциклы, скутеры и квадроциклы', 'Motorbike', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(16))), 'Грузовой транспорт', 'Коммерческий и грузовой транспорт', 'Truck', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(16))), 'Спецтехника', 'Строительная, дорожная и сельскохозяйственная техника', 'Tractor', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(16))), 'Водный транспорт', 'Катера, яхты и гидроциклы', 'Speedboat', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (lower(hex(randomblob(16))), 'Воздушный транспорт', 'Самолёты, вертолёты и другая авиация', 'Plane', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
