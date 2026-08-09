CREATE TABLE "VisitEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "sessionKey" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisitEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "VisitEvent_createdAt_idx" ON "VisitEvent"("createdAt");
CREATE INDEX "VisitEvent_path_createdAt_idx" ON "VisitEvent"("path", "createdAt");
CREATE INDEX "VisitEvent_sessionKey_createdAt_idx" ON "VisitEvent"("sessionKey", "createdAt");
CREATE INDEX "VisitEvent_userId_createdAt_idx" ON "VisitEvent"("userId", "createdAt");
