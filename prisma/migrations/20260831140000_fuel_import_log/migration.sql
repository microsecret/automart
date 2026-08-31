-- Живая лента прогона скрейпера АЗС.
--
-- Администратор смотрит на сбор как на консоль: видно, какую заправку
-- сейчас обошли, что там с ценами и наличием. Строки живут в базе, а не в
-- памяти процесса: страницу закрывают и открывают заново, приложение
-- перезапускается при деплое, а история прогона должна пережить и то, и
-- другое.
CREATE TABLE "FuelImportLogEntry" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "runId"     TEXT NOT NULL,
  "source"    TEXT NOT NULL,
  "city"      TEXT,
  "station"   TEXT,
  "address"   TEXT,
  "prices"    TEXT,
  "status"    TEXT,
  "kind"      TEXT NOT NULL DEFAULT 'STATION',
  "message"   TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FuelImportLogEntry_runId_fkey" FOREIGN KEY ("runId") REFERENCES "FuelImportRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FuelImportLogEntry_runId_createdAt_idx" ON "FuelImportLogEntry"("runId", "createdAt");
