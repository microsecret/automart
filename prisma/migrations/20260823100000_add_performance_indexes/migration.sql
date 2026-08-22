-- Индексы под запросы, которые сканировали таблицы целиком.
--
-- Каждый закрывает конкретный запрос из аудита. Таблицы сейчас невелики
-- (полторы тысячи визитов), поэтому построение мгновенно — правка делается
-- на упреждение, до того как рост данных начнёт бить по посетителям.

-- Посетитель без кук опознаётся по ipHash: без индекса каждый его просмотр
-- страницы сканировал таблицу визитов целиком.
CREATE INDEX "VisitEvent_ipHash_createdAt_idx" ON "VisitEvent"("ipHash", "createdAt");

-- Статистика выбирает просмотры за период по одному createdAt: составные
-- индексы такой запрос не покрывают.
CREATE INDEX "ListingViewEvent_createdAt_idx" ON "ListingViewEvent"("createdAt");

-- Список диалогов ищет и по отправителю, и по получателю. Вторая ветка не
-- покрывалась: receiverId стоит вторым столбцом составного индекса.
CREATE INDEX "Message_receiverId_createdAt_idx" ON "Message"("receiverId", "createdAt");

-- Отзывы карточки выбираются по объявлению — самый частый запрос модели.
CREATE INDEX "Review_listingId_createdAt_idx" ON "Review"("listingId", "createdAt");

-- Список уведомлений: фильтр по пользователю с сортировкой по дате.
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
