-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rate" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ExchangeRate_source_idx" ON "ExchangeRate"("source");

-- CreateIndex
CREATE INDEX "ExchangeRate_timestamp_idx" ON "ExchangeRate"("timestamp");
