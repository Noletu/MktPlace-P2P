-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "validationDeadline" DATETIME;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "customDailyLimit" REAL;
ALTER TABLE "User" ADD COLUMN "customLimitNote" TEXT;
ALTER TABLE "User" ADD COLUMN "customLimitSetAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "customLimitSetBy" TEXT;

-- CreateTable
CREATE TABLE "PlatformTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platformWalletId" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "networkFee" TEXT,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "note" TEXT,
    "lastError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "PlatformTransfer_platformWalletId_fkey" FOREIGN KEY ("platformWalletId") REFERENCES "PlatformWallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformWalletMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platformWalletId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "balanceBefore" TEXT NOT NULL,
    "balanceAfter" TEXT NOT NULL,
    "orderId" TEXT,
    "txHash" TEXT,
    "toAddress" TEXT,
    "fromAddress" TEXT,
    "userId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformWalletMovement_platformWalletId_fkey" FOREIGN KEY ("platformWalletId") REFERENCES "PlatformWallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SweepTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userWalletId" TEXT NOT NULL,
    "platformWalletId" TEXT NOT NULL,
    "cryptoType" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "gasFundingTxHash" TEXT,
    "gasFundingAmount" TEXT,
    "gasFundingStatus" TEXT,
    "sweepTxHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "SweepTransaction_userWalletId_fkey" FOREIGN KEY ("userWalletId") REFERENCES "UserWallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SweepTransaction_platformWalletId_fkey" FOREIGN KEY ("platformWalletId") REFERENCES "PlatformWallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PlatformWallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cryptoType" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "derivationPath" TEXT NOT NULL,
    "accountIndex" INTEGER NOT NULL DEFAULT 0,
    "encryptedPrivateKey" TEXT NOT NULL,
    "balance" TEXT NOT NULL DEFAULT '0',
    "availableBalance" TEXT NOT NULL DEFAULT '0',
    "totalFeesCollected" TEXT NOT NULL DEFAULT '0',
    "totalDeposited" TEXT NOT NULL DEFAULT '0',
    "totalWithdrawn" TEXT NOT NULL DEFAULT '0',
    "totalRefunded" TEXT NOT NULL DEFAULT '0',
    "totalCollected" TEXT NOT NULL DEFAULT '0',
    "lastSyncedAt" DATETIME,
    "lastBlockHeight" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PlatformWallet" ("accountIndex", "address", "availableBalance", "balance", "createdAt", "cryptoType", "derivationPath", "encryptedPrivateKey", "id", "isActive", "lastBlockHeight", "lastSyncedAt", "network", "totalDeposited", "totalFeesCollected", "totalWithdrawn", "updatedAt") SELECT "accountIndex", "address", "availableBalance", "balance", "createdAt", "cryptoType", "derivationPath", "encryptedPrivateKey", "id", "isActive", "lastBlockHeight", "lastSyncedAt", "network", "totalDeposited", "totalFeesCollected", "totalWithdrawn", "updatedAt" FROM "PlatformWallet";
DROP TABLE "PlatformWallet";
ALTER TABLE "new_PlatformWallet" RENAME TO "PlatformWallet";
CREATE INDEX "PlatformWallet_cryptoType_idx" ON "PlatformWallet"("cryptoType");
CREATE INDEX "PlatformWallet_network_idx" ON "PlatformWallet"("network");
CREATE INDEX "PlatformWallet_address_idx" ON "PlatformWallet"("address");
CREATE INDEX "PlatformWallet_isActive_idx" ON "PlatformWallet"("isActive");
CREATE UNIQUE INDEX "PlatformWallet_cryptoType_network_key" ON "PlatformWallet"("cryptoType", "network");
CREATE TABLE "new_UserWallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cryptoType" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "derivationPath" TEXT NOT NULL,
    "encryptedPrivateKey" TEXT NOT NULL,
    "balance" TEXT NOT NULL DEFAULT '0',
    "lockedBalance" TEXT NOT NULL DEFAULT '0',
    "availableBalance" TEXT NOT NULL DEFAULT '0',
    "totalDeposited" TEXT NOT NULL DEFAULT '0',
    "totalWithdrawn" TEXT NOT NULL DEFAULT '0',
    "totalUsed" TEXT NOT NULL DEFAULT '0',
    "lastSyncedAt" DATETIME,
    "lastBlockHeight" INTEGER,
    "onChainSnapshot" TEXT NOT NULL DEFAULT '0',
    "lastSweptAt" DATETIME,
    "sweepStatus" TEXT NOT NULL DEFAULT 'NONE',
    "pendingSweepAmount" TEXT NOT NULL DEFAULT '0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "creationSource" TEXT,
    "creationDetails" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserWallet" ("address", "availableBalance", "balance", "createdAt", "cryptoType", "derivationPath", "encryptedPrivateKey", "id", "isActive", "lastBlockHeight", "lastSyncedAt", "lockedBalance", "network", "totalDeposited", "totalUsed", "totalWithdrawn", "updatedAt", "userId") SELECT "address", "availableBalance", "balance", "createdAt", "cryptoType", "derivationPath", "encryptedPrivateKey", "id", "isActive", "lastBlockHeight", "lastSyncedAt", "lockedBalance", "network", "totalDeposited", "totalUsed", "totalWithdrawn", "updatedAt", "userId" FROM "UserWallet";
DROP TABLE "UserWallet";
ALTER TABLE "new_UserWallet" RENAME TO "UserWallet";
CREATE INDEX "UserWallet_userId_idx" ON "UserWallet"("userId");
CREATE INDEX "UserWallet_address_idx" ON "UserWallet"("address");
CREATE INDEX "UserWallet_cryptoType_network_idx" ON "UserWallet"("cryptoType", "network");
CREATE INDEX "UserWallet_isActive_idx" ON "UserWallet"("isActive");
CREATE UNIQUE INDEX "UserWallet_userId_cryptoType_network_key" ON "UserWallet"("userId", "cryptoType", "network");
CREATE TABLE "new_Withdrawal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "networkFee" TEXT,
    "platformFee" TEXT,
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" DATETIME,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "Withdrawal_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Withdrawal" ("amount", "completedAt", "createdAt", "id", "networkFee", "platformFee", "processedAt", "status", "toAddress", "txHash", "walletId") SELECT "amount", "completedAt", "createdAt", "id", "networkFee", "platformFee", "processedAt", "status", "toAddress", "txHash", "walletId" FROM "Withdrawal";
DROP TABLE "Withdrawal";
ALTER TABLE "new_Withdrawal" RENAME TO "Withdrawal";
CREATE UNIQUE INDEX "Withdrawal_txHash_key" ON "Withdrawal"("txHash");
CREATE INDEX "Withdrawal_walletId_idx" ON "Withdrawal"("walletId");
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");
CREATE INDEX "Withdrawal_createdAt_idx" ON "Withdrawal"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PlatformTransfer_platformWalletId_idx" ON "PlatformTransfer"("platformWalletId");

-- CreateIndex
CREATE INDEX "PlatformTransfer_status_idx" ON "PlatformTransfer"("status");

-- CreateIndex
CREATE INDEX "PlatformTransfer_requestedBy_idx" ON "PlatformTransfer"("requestedBy");

-- CreateIndex
CREATE INDEX "PlatformWalletMovement_platformWalletId_idx" ON "PlatformWalletMovement"("platformWalletId");

-- CreateIndex
CREATE INDEX "PlatformWalletMovement_type_idx" ON "PlatformWalletMovement"("type");

-- CreateIndex
CREATE INDEX "PlatformWalletMovement_direction_idx" ON "PlatformWalletMovement"("direction");

-- CreateIndex
CREATE INDEX "PlatformWalletMovement_createdAt_idx" ON "PlatformWalletMovement"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformWalletMovement_orderId_idx" ON "PlatformWalletMovement"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "SweepTransaction_sweepTxHash_key" ON "SweepTransaction"("sweepTxHash");

-- CreateIndex
CREATE INDEX "SweepTransaction_userWalletId_idx" ON "SweepTransaction"("userWalletId");

-- CreateIndex
CREATE INDEX "SweepTransaction_platformWalletId_idx" ON "SweepTransaction"("platformWalletId");

-- CreateIndex
CREATE INDEX "SweepTransaction_status_idx" ON "SweepTransaction"("status");
