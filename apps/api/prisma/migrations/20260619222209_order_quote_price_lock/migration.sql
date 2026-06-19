-- CreateTable
CREATE TABLE "OrderQuote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cryptoType" TEXT NOT NULL,
    "unitPrice" DECIMAL(38,18) NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "orderId" TEXT,

    CONSTRAINT "OrderQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderQuote_userId_idx" ON "OrderQuote"("userId");

-- CreateIndex
CREATE INDEX "OrderQuote_expiresAt_idx" ON "OrderQuote"("expiresAt");

-- AddForeignKey
ALTER TABLE "OrderQuote" ADD CONSTRAINT "OrderQuote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
