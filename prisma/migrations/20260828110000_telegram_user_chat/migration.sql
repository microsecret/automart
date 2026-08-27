-- Из какого чата человек пришёл на площадку.
--
-- Объявление уходит именно туда: его увидят те, среди кого продавец уже
-- состоит, а не посторонние из общего потока. Для чата под Владивосток
-- это разница между «продаю Prado» среди своих и тем же объявлением
-- среди всей страны.
--
-- Связь записывается, когда человек пишет в группе с ботом: там видно и
-- его, и чат сразу. При регистрации на сайте таких сведений нет вовсе.

CREATE TABLE "TelegramUserChat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    -- Когда человека последний раз видели в этом чате. По ней выбирается
    -- чат для публикации, если он состоит в нескольких: свежий ближе.
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramUserChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TelegramUserChat_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "TelegramChat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Одна запись на человека и чат: он пишет туда постоянно, и без этого
-- таблица росла бы на строку с каждого сообщения.
CREATE UNIQUE INDEX "TelegramUserChat_userId_chatId_key" ON "TelegramUserChat"("userId", "chatId");

CREATE INDEX "TelegramUserChat_userId_lastSeenAt_idx" ON "TelegramUserChat"("userId", "lastSeenAt");

-- Бесплатная публикация объявления в чате продавца.
--
-- Отдельно от ChatPromotionPost: тот привязан к оплаченному заказу и
-- живёт по его сроку, а эта запись нужна лишь для того, чтобы не
-- отправить одно объявление в тот же чат дважды.
CREATE TABLE "ListingChatPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    CONSTRAINT "ListingChatPost_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Одно объявление — один пост в чате: объявление могли снять и вернуть,
-- а два одинаковых поста подряд раздражают больше, чем их отсутствие.
CREATE UNIQUE INDEX "ListingChatPost_listingId_chatId_key" ON "ListingChatPost"("listingId", "chatId");

CREATE INDEX "ListingChatPost_chatId_publishedAt_idx" ON "ListingChatPost"("chatId", "publishedAt");
