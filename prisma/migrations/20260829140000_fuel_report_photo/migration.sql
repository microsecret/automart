-- Снимок колонки и комментарий к отметке наличия.
--
-- Спорная отметка — обычное дело, когда топливо кончается на глазах, и
-- фотография табло снимает спор быстрее любого счётчика подтверждений.

ALTER TABLE "FuelAvailabilityReport" ADD COLUMN "photo" TEXT;
ALTER TABLE "FuelAvailabilityReport" ADD COLUMN "comment" TEXT;
