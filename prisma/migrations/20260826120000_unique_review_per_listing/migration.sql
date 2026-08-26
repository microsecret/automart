-- Один отзыв автора на объявление.
--
-- Проверка «отзыв уже оставлен» была реализована кодом (findFirst перед
-- create) без ограничения в базе: два одновременных запроса создавали два
-- отзыва и вдвое искажали среднюю оценку продавца.
--
-- Сначала убираются уже существующие дубли — остаётся самый ранний по
-- времени создания, — иначе уникальный индекс не построится.

DELETE FROM "Review"
WHERE "listingId" IS NOT NULL
  AND "id" NOT IN (
    SELECT "id" FROM (
      SELECT "id",
             ROW_NUMBER() OVER (
               PARTITION BY "userId", "listingId"
               ORDER BY "createdAt", "id"
             ) AS "rn"
      FROM "Review"
      WHERE "listingId" IS NOT NULL
    )
    WHERE "rn" = 1
  );

CREATE UNIQUE INDEX "Review_userId_listingId_key" ON "Review"("userId", "listingId");
