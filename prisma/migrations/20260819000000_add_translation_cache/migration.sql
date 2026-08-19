-- Кэш переводов между запусками.
--
-- Кэш в памяти процесса терялся при каждом перезапуске, и после деплоя
-- сборщик переводил те же названия заново — через прокси это десятки секунд
-- на строку.
CREATE TABLE "TranslationCache" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "sourceText" TEXT NOT NULL,
    "translated" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'text',
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "TranslationCache_updatedAt_idx" ON "TranslationCache"("updatedAt");
