-- AlterTable: Add negotiation and presence system fields
ALTER TABLE "Order" ADD COLUMN "negotiatingUserId" TEXT;
ALTER TABLE "Order" ADD COLUMN "negotiationStartedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "ownerOnline" BOOLEAN NOT NULL DEFAULT 0;

-- Add timestamp columns as nullable first
ALTER TABLE "Order" ADD COLUMN "ownerLastSeenAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "ownerLastActivityAt" DATETIME;

-- Update existing rows with current timestamp
UPDATE "Order" SET "ownerLastSeenAt" = datetime('now') WHERE "ownerLastSeenAt" IS NULL;
UPDATE "Order" SET "ownerLastActivityAt" = datetime('now') WHERE "ownerLastActivityAt" IS NULL;

-- CreateIndex
CREATE INDEX "Order_negotiatingUserId_idx" ON "Order"("negotiatingUserId");
CREATE INDEX "Order_negotiationStartedAt_idx" ON "Order"("negotiationStartedAt");
CREATE INDEX "Order_ownerOnline_idx" ON "Order"("ownerOnline");
CREATE INDEX "Order_ownerLastSeenAt_idx" ON "Order"("ownerLastSeenAt");
