-- Индексы для наиболее частых фильтров каталогов.
CREATE INDEX "Part_partType_price_condition_idx" ON "Part"("partType", "price", "condition");
CREATE INDEX "AuctionListing_country_source_status_auctionDate_idx" ON "AuctionListing"("country", "source", "status", "auctionDate");
