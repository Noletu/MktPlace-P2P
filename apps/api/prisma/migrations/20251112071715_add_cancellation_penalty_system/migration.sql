-- AlterTable: Add cancellation tracking fields to User
ALTER TABLE "User" ADD COLUMN "totalCancellations" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "recentCancellations" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lastCancellationAt" DATETIME;

-- AlterTable: Add cancellation details to Order
ALTER TABLE "Order" ADD COLUMN "cancelledBy" TEXT;
ALTER TABLE "Order" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "Order" ADD COLUMN "cancellationNote" TEXT;

-- CreateTable: CancellationHistory
CREATE TABLE "CancellationHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "penaltyApplied" BOOLEAN NOT NULL DEFAULT false,
    "penaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "reputationBefore" INTEGER,
    "reputationAfter" INTEGER,
    "orderStatus" TEXT NOT NULL,
    "orderValue" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CancellationHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CancellationHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CancellationHistory_userId_idx" ON "CancellationHistory"("userId");
CREATE INDEX "CancellationHistory_orderId_idx" ON "CancellationHistory"("orderId");
CREATE INDEX "CancellationHistory_role_idx" ON "CancellationHistory"("role");
CREATE INDEX "CancellationHistory_createdAt_idx" ON "CancellationHistory"("createdAt");
CREATE INDEX "CancellationHistory_penaltyApplied_idx" ON "CancellationHistory"("penaltyApplied");
