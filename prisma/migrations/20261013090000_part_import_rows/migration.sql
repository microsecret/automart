-- Разобранные строки прайса хранятся в партии: публикация берёт их отсюда,
-- а не 25 строк предпросмотра из браузера.
ALTER TABLE "PartImportBatch" ADD COLUMN "rowsJson" TEXT;
