-- Опросы в темах форума.
--
-- Вопрос «какую взять» повторяется в каждом втором обсуждении, и ответы
-- тонут в сотне сообщений. Опрос собирает то же мнение в цифру, которую
-- видно сразу, и удерживает человека в теме: проголосовавший приходит
-- смотреть, чем кончилось.

CREATE TABLE "ForumPoll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "closesAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ForumPoll_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ForumTopic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Опрос один на тему: два голосования в одном обсуждении делят внимание,
-- и оба остаются недоголосованными.
CREATE UNIQUE INDEX "ForumPoll_topicId_key" ON "ForumPoll"("topicId");

CREATE TABLE "ForumPollOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pollId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    -- Счётчик полем, а не запросом: страница темы открывается на каждый
    -- заход, и COUNT по всем голосам при живом опросе становится самым
    -- дорогим запросом страницы.
    "votes" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ForumPollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ForumPoll" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ForumPollOption_pollId_position_idx" ON "ForumPollOption"("pollId", "position");

CREATE TABLE "ForumPollVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ForumPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "ForumPoll" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForumPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ForumPollOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForumPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Ограничение в базе, а не в проверке кода: два нажатия подряд с
-- телефона уходят двумя запросами одновременно, и проверка «уже
-- голосовал» пропустит оба.
CREATE UNIQUE INDEX "ForumPollVote_optionId_userId_key" ON "ForumPollVote"("optionId", "userId");

CREATE INDEX "ForumPollVote_pollId_userId_idx" ON "ForumPollVote"("pollId", "userId");
