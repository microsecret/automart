-- Магазины владельца по состоянию: горячий путь в заявках на запчасти.
-- Порознь индексы этого не покрывают — база берёт один и отсеивает
-- остальное перебором.
CREATE INDEX "PartStore_ownerId_status_idx" ON "PartStore"("ownerId", "status");

-- Рассылка в чаты ищет оплаченные заказы тарифа с непросроченным сроком
-- показа, и делает это каждые несколько минут. Существующие индексы не
-- покрывают ни тариф, ни диапазон по сроку.
CREATE INDEX "PromotionOrder_tariffId_status_promoUntil_idx" ON "PromotionOrder"("tariffId", "status", "promoUntil");
