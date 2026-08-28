-- Публикация обсуждений форума в чатах сети.
--
-- Форум с тринадцатью темами не растёт сам: человек не заходит проверять
-- площадку, о которой не помнит. А в чатах уже сидят те, кому вопрос
-- интересен — их надо позвать, а не ждать.

CREATE TABLE "ForumChatPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" INTEGER NOT NULL,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ForumChatPost_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ForumTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Одна тема — один пост в чате: без этого она уходила бы по кругу при
-- каждом запуске рассылки.
CREATE UNIQUE INDEX "ForumChatPost_topicId_chatId_key" ON "ForumChatPost"("topicId", "chatId");

-- По времени публикации считается, сколько постов ушло за сутки.
CREATE INDEX "ForumChatPost_publishedAt_idx" ON "ForumChatPost"("publishedAt");
