-- Название и город заправки в отметке наличия.
--
-- Точки живут в OpenStreetMap, а не у нас: без этих полей сводка по городу
-- называла бы заправки кодами вида «osm-node-123», а уведомление
-- подписчику — просто «АЗС».

ALTER TABLE "FuelAvailabilityReport" ADD COLUMN "stationName" TEXT;
ALTER TABLE "FuelAvailabilityReport" ADD COLUMN "city" TEXT;
