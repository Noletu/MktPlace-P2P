-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failed2FAAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last2FAFailAt" TIMESTAMP(3),
ADD COLUMN     "twoFactorLockedUntil" TIMESTAMP(3),
ADD COLUMN     "twoFactorLockoutCount" INTEGER NOT NULL DEFAULT 0;
