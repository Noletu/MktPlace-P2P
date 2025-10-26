-- Remove cpf field from User table (should only be in KYCVerification)
-- SQLite doesn't support DROP COLUMN, so we need to recreate the table

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "kycLevel" TEXT NOT NULL DEFAULT 'NONE',
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "successfulTransactions" INTEGER NOT NULL DEFAULT 0,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT 0,
    "twoFactorSecret" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Copy data from old table (excluding cpf)
INSERT INTO "new_User" SELECT "id", "email", "password", "name", "kycLevel", "reputationScore", "totalTransactions", "successfulTransactions", "role", "twoFactorEnabled", "twoFactorSecret", "createdAt", "updatedAt" FROM "User";

-- Drop old table
DROP TABLE "User";

-- Rename new table
ALTER TABLE "new_User" RENAME TO "User";

-- Recreate indexes
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Create PlatformWallet table (for storing platform crypto addresses)
CREATE TABLE "PlatformWallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cryptoType" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT
);

-- Create indexes for PlatformWallet
CREATE UNIQUE INDEX "PlatformWallet_address_key" ON "PlatformWallet"("address");
CREATE INDEX "PlatformWallet_cryptoType_idx" ON "PlatformWallet"("cryptoType");
CREATE INDEX "PlatformWallet_network_idx" ON "PlatformWallet"("network");
CREATE INDEX "PlatformWallet_isActive_idx" ON "PlatformWallet"("isActive");

PRAGMA foreign_keys=ON;
