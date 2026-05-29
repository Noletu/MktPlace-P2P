/*
  Warnings:

  - You are about to drop the column `customDailyLimitStr` on the `User` table. All the data in the column will be lost.
  - You are about to alter the column `customDailyLimit` on the `User` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(20,2)`.
  - Added the required column `updatedAt` to the `ChatArchive` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Withdrawal` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ChatArchive" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
-- ⚠️ ATENÇÃO: as 3 linhas originais sobre hdAccountIndex (SET DEFAULT / DROP DEFAULT / DROP SEQUENCE)
-- foram removidas manualmente. Causa: user_hd_account_seq foi criada via raw SQL na migration
-- 20260520000000_add_hd_account_index — o Prisma não a reconhece como objeto próprio e gera
-- DROP SEQUENCE a cada migration que toca o User table. Solução duradoura: TD-SCHEMA01.
ALTER TABLE "User" DROP COLUMN "customDailyLimitStr",
ALTER COLUMN "customDailyLimit" SET DATA TYPE DECIMAL(20,2);

-- AlterTable
ALTER TABLE "Withdrawal" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
