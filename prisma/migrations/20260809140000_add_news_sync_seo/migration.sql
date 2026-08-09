-- Redefine the table instead of adding updatedAt with CURRENT_TIMESTAMP.
-- SQLite accepts that default only while creating a table, not in ALTER TABLE.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_News" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "imageUrl" TEXT,
    "sourceUrl" TEXT,
    "telegramUrl" TEXT,
    "sourceKey" TEXT,
    "sourceChannel" TEXT,
    "sourceMessageId" INTEGER,
    "author" TEXT,
    "tags" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_News" ("id", "title", "content", "excerpt", "imageUrl", "sourceUrl", "publishedAt", "views", "createdAt")
SELECT "id", "title", "content", "excerpt", "imageUrl", "sourceUrl", "publishedAt", "views", "createdAt" FROM "News";

DROP TABLE "News";
ALTER TABLE "new_News" RENAME TO "News";

CREATE UNIQUE INDEX "News_slug_key" ON "News"("slug");
CREATE UNIQUE INDEX "News_sourceKey_key" ON "News"("sourceKey");
CREATE INDEX "News_publishedAt_idx" ON "News"("publishedAt");
CREATE INDEX "News_sourceChannel_sourceMessageId_idx" ON "News"("sourceChannel", "sourceMessageId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
