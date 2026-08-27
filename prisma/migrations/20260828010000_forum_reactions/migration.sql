-- Реакции, лучший ответ и репутация на форуме.
--
-- «Спасибо, помогло» пишут отдельным сообщением, и в теме о ремонте
-- половина ответов — благодарности, между которыми теряется суть.
-- Реакция говорит то же самое, не занимая места в разговоре.

-- Колонки добавляются с умолчанием: существующие сообщения получают ноль
-- реакций и снятую отметку, переносить ничего не нужно.
ALTER TABLE "ForumPost" ADD COLUMN "isBestAnswer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ForumPost" ADD COLUMN "reactionCount" INTEGER NOT NULL DEFAULT 0;

-- Поиск лучшего ответа в теме: он показывается над остальными.
CREATE INDEX "ForumPost_topicId_isBestAnswer_idx" ON "ForumPost"("topicId", "isBestAnswer");

-- Репутация хранится полем, а не считается запросом: число показывается
-- рядом с каждым сообщением, и подсчёт по всем реакциям человека на
-- каждое из двадцати сообщений страницы — это двадцать запросов там, где
-- нужно ноль.
ALTER TABLE "User" ADD COLUMN "forumReputation" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "forumBestAnswers" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ForumReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    -- Вид реакции: HELPFUL, THANKS, ACCURATE. Список закрытый и короткий:
    -- два десятка значков превращают ответы в ярмарку, а не в оценку.
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ForumReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ForumReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Одна реакция каждого вида от человека на сообщение. Ограничение в базе,
-- а не в проверке кода: два нажатия подряд уходят двумя запросами
-- одновременно, и проверка пропустила бы оба.
CREATE UNIQUE INDEX "ForumReaction_postId_userId_kind_key" ON "ForumReaction"("postId", "userId", "kind");

CREATE INDEX "ForumReaction_postId_idx" ON "ForumReaction"("postId");
