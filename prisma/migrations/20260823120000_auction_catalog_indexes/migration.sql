-- Каталог аукционов сортировал все строки во временном дереве.
--
-- EXPLAIN QUERY PLAN на боевой базе показывал USE TEMP B-TREE FOR ORDER BY
-- на каждом запросе страницы: индекс на одном status не покрывал
-- сортировку по дате, а под медиану цены индекса не было вовсе.
--
-- Замер на копии базы с 33 751 лотом:
--   первая страница        206 → 3 мс
--   сто восемьдесят седьмая 874 → 19 мс
--   медиана цены           203 → 23 мс
CREATE INDEX "AuctionListing_status_adminHiddenAt_createdAt_idx"
  ON "AuctionListing"("status", "adminHiddenAt", "createdAt");

CREATE INDEX "AuctionListing_status_adminHiddenAt_finalPrice_idx"
  ON "AuctionListing"("status", "adminHiddenAt", "finalPrice");
