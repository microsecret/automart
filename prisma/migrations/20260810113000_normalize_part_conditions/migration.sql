-- Запчасть — товар, поэтому оставляем только понятные покупателю состояния.
-- Оценочные архивные значения корректно относятся к категории «Б/у».
UPDATE "Part"
SET "condition" = 'USED'
WHERE "condition" IS NOT NULL AND "condition" <> 'NEW' AND "condition" <> 'USED';
