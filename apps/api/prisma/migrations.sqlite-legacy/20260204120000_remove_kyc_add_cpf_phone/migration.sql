-- DataMigration: Save KYC data before dropping table
CREATE TEMPORARY TABLE "_kyc_migration" AS SELECT "userId", "cpf", "phone" FROM "KYCVerification";

-- DropIndex
DROP INDEX IF EXISTS "KYCVerification_submittedAt_idx";
DROP INDEX IF EXISTS "KYCVerification_cpf_idx";
DROP INDEX IF EXISTS "KYCVerification_level_idx";
DROP INDEX IF EXISTS "KYCVerification_status_idx";
DROP INDEX IF EXISTS "KYCVerification_userId_idx";
DROP INDEX IF EXISTS "KYCVerification_cpf_key";
DROP INDEX IF EXISTS "KYCVerification_userId_key";

DROP INDEX IF EXISTS "PhoneVerificationCode_expiresAt_idx";
DROP INDEX IF EXISTS "PhoneVerificationCode_status_idx";
DROP INDEX IF EXISTS "PhoneVerificationCode_code_idx";
DROP INDEX IF EXISTS "PhoneVerificationCode_phone_idx";

-- DropTable KYCVerification
PRAGMA foreign_keys=off;
DROP TABLE "KYCVerification";
PRAGMA foreign_keys=on;

-- DropTable PhoneVerificationCode
PRAGMA foreign_keys=off;
DROP TABLE "PhoneVerificationCode";
PRAGMA foreign_keys=on;

-- RedefineTables: User (remove kycLevel, add cpf/phone)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "cpf" TEXT,
    "phone" TEXT,
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "successfulTransactions" INTEGER NOT NULL DEFAULT 0,
    "totalCancellations" INTEGER NOT NULL DEFAULT 0,
    "recentCancellations" INTEGER NOT NULL DEFAULT 0,
    "lastCancellationAt" DATETIME,
    "roleId" TEXT,
    "legacyRole" TEXT NOT NULL DEFAULT 'USER',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorTempSecret" TEXT,
    "twoFactorBackupCodes" TEXT,
    "accountFrozen" BOOLEAN NOT NULL DEFAULT false,
    "frozenReason" TEXT,
    "frozenAt" DATETIME,
    "frozenBy" TEXT,
    "frozenUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("accountFrozen", "createdAt", "email", "frozenAt", "frozenBy", "frozenReason", "frozenUntil", "id", "lastCancellationAt", "legacyRole", "name", "password", "recentCancellations", "reputationScore", "roleId", "successfulTransactions", "totalCancellations", "totalTransactions", "twoFactorBackupCodes", "twoFactorEnabled", "twoFactorSecret", "twoFactorTempSecret", "updatedAt") SELECT "accountFrozen", "createdAt", "email", "frozenAt", "frozenBy", "frozenReason", "frozenUntil", "id", "lastCancellationAt", "legacyRole", "name", "password", "recentCancellations", "reputationScore", "roleId", "successfulTransactions", "totalCancellations", "totalTransactions", "twoFactorBackupCodes", "twoFactorEnabled", "twoFactorSecret", "twoFactorTempSecret", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");

-- DataMigration: Restore CPF/phone from KYC data
UPDATE "User" SET
    "cpf" = (SELECT "cpf" FROM "_kyc_migration" WHERE "_kyc_migration"."userId" = "User"."id"),
    "phone" = (SELECT "phone" FROM "_kyc_migration" WHERE "_kyc_migration"."userId" = "User"."id")
WHERE "id" IN (SELECT "userId" FROM "_kyc_migration");

DROP TABLE "_kyc_migration";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
