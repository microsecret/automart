-- Подписки на темы и жалобы на сообщения.
--
-- Человек спросил и ушёл: без уведомления он не узнает, что ответили, и
-- вернётся разве что случайно. А без жалоб спам убирать некому —
-- модератор не читает каждую тему, и участник, наткнувшийся на рекламу,
-- уходит и больше не возвращается.

CREATE TABLE "ForumSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ForumSubscription_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ForumTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForumSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Одна подписка на человека и тему: два нажатия подряд уходят двумя
-- запросами одновременно, и проверка в коде пропустила бы оба.
CREATE UNIQUE INDEX "ForumSubscription_topicId_userId_key" ON "ForumSubscription"("topicId", "userId");
CREATE INDEX "ForumSubscription_userId_idx" ON "ForumSubscription"("userId");

CREATE TABLE "ForumReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    -- Причина: SPAM, RUDE, OFFTOPIC, WRONG, OTHER.
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ForumReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForumReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Одна жалоба от человека на сообщение: десять жалоб от одного не делают
-- проблему серьёзнее, а очередь модератора засоряют.
CREATE UNIQUE INDEX "ForumReport_postId_authorId_key" ON "ForumReport"("postId", "authorId");

-- Очередь модератора: неразобранные первыми, свежие сверху.
CREATE INDEX "ForumReport_resolvedAt_createdAt_idx" ON "ForumReport"("resolvedAt", "createdAt");

-- Автор темы подписан на неё: он задал вопрос и ждёт ответа больше всех.
INSERT INTO "ForumSubscription" ("id", "topicId", "userId", "createdAt")
SELECT lower(hex(randomblob(16))), "id", "authorId", "createdAt"
FROM "ForumTopic"
WHERE "deletedAt" IS NULL;
