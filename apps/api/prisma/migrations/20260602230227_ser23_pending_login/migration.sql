-- CreateTable
CREATE TABLE "PendingLogin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "attemptsRemaining" INTEGER NOT NULL DEFAULT 3,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingLogin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingLogin_tokenHash_key" ON "PendingLogin"("tokenHash");

-- CreateIndex
CREATE INDEX "PendingLogin_userId_idx" ON "PendingLogin"("userId");

-- CreateIndex
CREATE INDEX "PendingLogin_expiresAt_idx" ON "PendingLogin"("expiresAt");

-- AddForeignKey
ALTER TABLE "PendingLogin" ADD CONSTRAINT "PendingLogin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
