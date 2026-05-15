/*
  Warnings:

  - You are about to drop the `Deposit` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Wallet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `collateralDepositId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `collateralTxHash` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `PlatformWallet` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `PlatformWallet` table. All the data in the column will be lost.
  - Added the required column `derivationPath` to the `PlatformWallet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encryptedPrivateKey` to the `PlatformWallet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderId` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Review` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Deposit_txHash_key";

-- DropIndex
DROP INDEX "Wallet_userId_crypto_network_key";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "description" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "email" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "role" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Deposit";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Wallet";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "UserWallet" (
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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "balanceBefore" TEXT NOT NULL,
    "balanceAfter" TEXT NOT NULL,
    "lockedBefore" TEXT,
    "lockedAfter" TEXT,
    "txHash" TEXT,
    "blockHeight" INTEGER,
    "confirmations" INTEGER,
    "adminUserId" TEXT,
    "adminReason" TEXT,
    "relatedTxId" TEXT,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WalletTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "resolutionType" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Dispute_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispute_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Dispute_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Dispute_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DisputeMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "disputeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" TEXT,
    "isAdminMessage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisputeMessage_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DisputeMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "actionLabel" TEXT,
    "relatedId" TEXT,
    "relatedType" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "metadata" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "participant1Id" TEXT NOT NULL,
    "participant2Id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageAt" DATETIME,
    "unreadCount1" INTEGER NOT NULL DEFAULT 0,
    "unreadCount2" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chat_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Chat_participant1Id_fkey" FOREIGN KEY ("participant1Id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Chat_participant2Id_fkey" FOREIGN KEY ("participant2Id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chatId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "message" TEXT,
    "encryptedContent" TEXT,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "iv" TEXT,
    "attachments" TEXT,
    "attachmentUrl" TEXT,
    "attachmentType" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" DATETIME,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatArchive" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalChatId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "messagesSnapshot" TEXT NOT NULL,
    "archivedBy" TEXT,
    "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatArchive_originalChatId_fkey" FOREIGN KEY ("originalChatId") REFERENCES "Chat" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KYCVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "level" TEXT NOT NULL,
    "fullName" TEXT,
    "cpf" TEXT,
    "phone" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "phoneVerifiedAt" DATETIME,
    "dateOfBirth" DATETIME,
    "addressStreet" TEXT,
    "addressNumber" TEXT,
    "addressComplement" TEXT,
    "addressNeighborhood" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressZipCode" TEXT,
    "documentType" TEXT,
    "documentNumber" TEXT,
    "documentFrontUrl" TEXT,
    "documentBackUrl" TEXT,
    "selfieUrl" TEXT,
    "livenessScore" REAL,
    "livenessVerified" BOOLEAN NOT NULL DEFAULT false,
    "proofOfResidenceUrl" TEXT,
    "proofOfResidenceType" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "rejectionReason" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KYCVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhoneVerificationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserKeys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "encryptedPrivateKeyBackup" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserKeys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "cryptoType" TEXT NOT NULL,
    "cryptoNetwork" TEXT NOT NULL,
    "cryptoAmount" TEXT NOT NULL,
    "brlAmount" TEXT NOT NULL,
    "platformFee" TEXT NOT NULL,
    "payerReward" TEXT NOT NULL,
    "totalFee" TEXT NOT NULL,
    "orderData" TEXT NOT NULL,
    "walletId" TEXT,
    "collateralSource" TEXT,
    "collateralConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "collateralLocked" BOOLEAN NOT NULL DEFAULT false,
    "collateralLockedAmount" TEXT,
    "collateralUnlockedAt" DATETIME,
    "awaitingDeposit" BOOLEAN NOT NULL DEFAULT false,
    "depositDeadline" DATETIME,
    "depositConfirmedAt" DATETIME,
    "timeoutAt" DATETIME,
    "paidByPlatform" BOOLEAN NOT NULL DEFAULT false,
    "customExpirationHours" INTEGER,
    "manualCancelOnly" BOOLEAN NOT NULL DEFAULT false,
    "refundStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "refundMethod" TEXT,
    "refundTxHash" TEXT,
    "refundAmount" TEXT,
    "refundNetworkFee" TEXT,
    "refundProcessingFee" TEXT,
    "refundedAt" DATETIME,
    "cancelReason" TEXT,
    "cryptoTransferred" BOOLEAN NOT NULL DEFAULT false,
    "cryptoTransferredAt" DATETIME,
    "cryptoTransferredTo" TEXT,
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "cancellationNote" TEXT,
    "negotiatingUserId" TEXT,
    "negotiationStartedAt" DATETIME,
    "ownerOnline" BOOLEAN NOT NULL DEFAULT false,
    "ownerLastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerLastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("brlAmount", "cancellationNote", "cancellationReason", "cancelledBy", "collateralConfirmed", "completedAt", "createdAt", "cryptoAmount", "cryptoNetwork", "cryptoType", "id", "negotiatingUserId", "negotiationStartedAt", "orderData", "ownerLastActivityAt", "ownerLastSeenAt", "ownerOnline", "paidByPlatform", "payerReward", "platformFee", "status", "timeoutAt", "totalFee", "type", "updatedAt", "userId") SELECT "brlAmount", "cancellationNote", "cancellationReason", "cancelledBy", "collateralConfirmed", "completedAt", "createdAt", "cryptoAmount", "cryptoNetwork", "cryptoType", "id", "negotiatingUserId", "negotiationStartedAt", "orderData", coalesce("ownerLastActivityAt", CURRENT_TIMESTAMP) AS "ownerLastActivityAt", coalesce("ownerLastSeenAt", CURRENT_TIMESTAMP) AS "ownerLastSeenAt", "ownerOnline", "paidByPlatform", "payerReward", "platformFee", "status", "timeoutAt", "totalFee", "type", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_walletId_idx" ON "Order"("walletId");
CREATE INDEX "Order_negotiatingUserId_idx" ON "Order"("negotiatingUserId");
CREATE INDEX "Order_negotiationStartedAt_idx" ON "Order"("negotiationStartedAt");
CREATE INDEX "Order_ownerOnline_idx" ON "Order"("ownerOnline");
CREATE INDEX "Order_ownerLastSeenAt_idx" ON "Order"("ownerLastSeenAt");
CREATE INDEX "Order_awaitingDeposit_idx" ON "Order"("awaitingDeposit");
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
    "lastSyncedAt" DATETIME,
    "lastBlockHeight" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PlatformWallet" ("address", "createdAt", "cryptoType", "id", "isActive", "network", "updatedAt") SELECT "address", "createdAt", "cryptoType", "id", "isActive", "network", "updatedAt" FROM "PlatformWallet";
DROP TABLE "PlatformWallet";
ALTER TABLE "new_PlatformWallet" RENAME TO "PlatformWallet";
CREATE UNIQUE INDEX "PlatformWallet_address_key" ON "PlatformWallet"("address");
CREATE INDEX "PlatformWallet_cryptoType_idx" ON "PlatformWallet"("cryptoType");
CREATE INDEX "PlatformWallet_network_idx" ON "PlatformWallet"("network");
CREATE INDEX "PlatformWallet_address_idx" ON "PlatformWallet"("address");
CREATE INDEX "PlatformWallet_isActive_idx" ON "PlatformWallet"("isActive");
CREATE UNIQUE INDEX "PlatformWallet_cryptoType_network_key" ON "PlatformWallet"("cryptoType", "network");
CREATE TABLE "new_Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewerId" TEXT NOT NULL,
    "reviewedId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "transactionId" TEXT,
    "rating" INTEGER NOT NULL,
    "reliabilityRating" INTEGER,
    "communicationRating" INTEGER,
    "speedRating" INTEGER,
    "comment" TEXT,
    "response" TEXT,
    "respondedAt" DATETIME,
    "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_reviewedId_fkey" FOREIGN KEY ("reviewedId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Review" ("comment", "createdAt", "id", "rating", "reviewedId", "reviewerId") SELECT "comment", "createdAt", "id", "rating", "reviewedId", "reviewerId" FROM "Review";
DROP TABLE "Review";
ALTER TABLE "new_Review" RENAME TO "Review";
CREATE INDEX "Review_reviewedId_idx" ON "Review"("reviewedId");
CREATE INDEX "Review_orderId_idx" ON "Review"("orderId");
CREATE INDEX "Review_rating_idx" ON "Review"("rating");
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");
CREATE UNIQUE INDEX "Review_reviewerId_orderId_key" ON "Review"("reviewerId", "orderId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "kycLevel" TEXT NOT NULL DEFAULT 'NONE',
    "reputationScore" INTEGER NOT NULL DEFAULT 0,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "successfulTransactions" INTEGER NOT NULL DEFAULT 0,
    "totalCancellations" INTEGER NOT NULL DEFAULT 0,
    "recentCancellations" INTEGER NOT NULL DEFAULT 0,
    "lastCancellationAt" DATETIME,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorTempSecret" TEXT,
    "twoFactorBackupCodes" TEXT,
    "accountFrozen" BOOLEAN NOT NULL DEFAULT false,
    "frozenReason" TEXT,
    "frozenAt" DATETIME,
    "frozenBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "kycLevel", "lastCancellationAt", "name", "password", "recentCancellations", "reputationScore", "role", "successfulTransactions", "totalCancellations", "totalTransactions", "twoFactorBackupCodes", "twoFactorEnabled", "twoFactorSecret", "updatedAt") SELECT "createdAt", "email", "id", "kycLevel", "lastCancellationAt", "name", "password", "recentCancellations", "reputationScore", "role", "successfulTransactions", "totalCancellations", "totalTransactions", "twoFactorBackupCodes", "twoFactorEnabled", "twoFactorSecret", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "new_Withdrawal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletId" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "networkFee" TEXT,
    "platformFee" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "Withdrawal_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "UserWallet" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Withdrawal" ("amount", "createdAt", "id", "processedAt", "status", "toAddress", "txHash", "walletId") SELECT "amount", "createdAt", "id", "processedAt", "status", "toAddress", "txHash", "walletId" FROM "Withdrawal";
DROP TABLE "Withdrawal";
ALTER TABLE "new_Withdrawal" RENAME TO "Withdrawal";
CREATE UNIQUE INDEX "Withdrawal_txHash_key" ON "Withdrawal"("txHash");
CREATE INDEX "Withdrawal_walletId_idx" ON "Withdrawal"("walletId");
CREATE INDEX "Withdrawal_status_idx" ON "Withdrawal"("status");
CREATE INDEX "Withdrawal_createdAt_idx" ON "Withdrawal"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UserWallet_userId_idx" ON "UserWallet"("userId");

-- CreateIndex
CREATE INDEX "UserWallet_address_idx" ON "UserWallet"("address");

-- CreateIndex
CREATE INDEX "UserWallet_cryptoType_network_idx" ON "UserWallet"("cryptoType", "network");

-- CreateIndex
CREATE INDEX "UserWallet_isActive_idx" ON "UserWallet"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UserWallet_userId_cryptoType_network_key" ON "UserWallet"("userId", "cryptoType", "network");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_idx" ON "WalletTransaction"("walletId");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_idx" ON "WalletTransaction"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_orderId_idx" ON "WalletTransaction"("orderId");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- CreateIndex
CREATE INDEX "WalletTransaction_txHash_idx" ON "WalletTransaction"("txHash");

-- CreateIndex
CREATE INDEX "WalletTransaction_createdAt_idx" ON "WalletTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAction_adminId_idx" ON "AdminAction"("adminId");

-- CreateIndex
CREATE INDEX "AdminAction_resource_idx" ON "AdminAction"("resource");

-- CreateIndex
CREATE INDEX "AdminAction_createdAt_idx" ON "AdminAction"("createdAt");

-- CreateIndex
CREATE INDEX "Dispute_orderId_idx" ON "Dispute"("orderId");

-- CreateIndex
CREATE INDEX "Dispute_transactionId_idx" ON "Dispute"("transactionId");

-- CreateIndex
CREATE INDEX "Dispute_createdBy_idx" ON "Dispute"("createdBy");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_createdAt_idx" ON "Dispute"("createdAt");

-- CreateIndex
CREATE INDEX "DisputeMessage_disputeId_idx" ON "DisputeMessage"("disputeId");

-- CreateIndex
CREATE INDEX "DisputeMessage_authorId_idx" ON "DisputeMessage"("authorId");

-- CreateIndex
CREATE INDEX "DisputeMessage_createdAt_idx" ON "DisputeMessage"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_category_idx" ON "Notification"("category");

-- CreateIndex
CREATE INDEX "Notification_isRead_idx" ON "Notification"("isRead");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_orderId_key" ON "Chat"("orderId");

-- CreateIndex
CREATE INDEX "Chat_orderId_idx" ON "Chat"("orderId");

-- CreateIndex
CREATE INDEX "Chat_participant1Id_idx" ON "Chat"("participant1Id");

-- CreateIndex
CREATE INDEX "Chat_participant2Id_idx" ON "Chat"("participant2Id");

-- CreateIndex
CREATE INDEX "Chat_lastMessageAt_idx" ON "Chat"("lastMessageAt");

-- CreateIndex
CREATE INDEX "Chat_isActive_idx" ON "Chat"("isActive");

-- CreateIndex
CREATE INDEX "ChatMessage_chatId_idx" ON "ChatMessage"("chatId");

-- CreateIndex
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_isRead_idx" ON "ChatMessage"("isRead");

-- CreateIndex
CREATE INDEX "ChatArchive_originalChatId_idx" ON "ChatArchive"("originalChatId");

-- CreateIndex
CREATE INDEX "ChatArchive_reason_idx" ON "ChatArchive"("reason");

-- CreateIndex
CREATE INDEX "ChatArchive_expiresAt_idx" ON "ChatArchive"("expiresAt");

-- CreateIndex
CREATE INDEX "ChatArchive_isDeleted_idx" ON "ChatArchive"("isDeleted");

-- CreateIndex
CREATE INDEX "ChatArchive_archivedAt_idx" ON "ChatArchive"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KYCVerification_userId_key" ON "KYCVerification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KYCVerification_cpf_key" ON "KYCVerification"("cpf");

-- CreateIndex
CREATE INDEX "KYCVerification_userId_idx" ON "KYCVerification"("userId");

-- CreateIndex
CREATE INDEX "KYCVerification_status_idx" ON "KYCVerification"("status");

-- CreateIndex
CREATE INDEX "KYCVerification_level_idx" ON "KYCVerification"("level");

-- CreateIndex
CREATE INDEX "KYCVerification_cpf_idx" ON "KYCVerification"("cpf");

-- CreateIndex
CREATE INDEX "KYCVerification_submittedAt_idx" ON "KYCVerification"("submittedAt");

-- CreateIndex
CREATE INDEX "PhoneVerificationCode_phone_idx" ON "PhoneVerificationCode"("phone");

-- CreateIndex
CREATE INDEX "PhoneVerificationCode_code_idx" ON "PhoneVerificationCode"("code");

-- CreateIndex
CREATE INDEX "PhoneVerificationCode_status_idx" ON "PhoneVerificationCode"("status");

-- CreateIndex
CREATE INDEX "PhoneVerificationCode_expiresAt_idx" ON "PhoneVerificationCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserKeys_userId_key" ON "UserKeys"("userId");

-- CreateIndex
CREATE INDEX "UserKeys_userId_idx" ON "UserKeys"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_success_idx" ON "AuditLog"("success");

-- CreateIndex
CREATE INDEX "AuditLog_ipAddress_idx" ON "AuditLog"("ipAddress");
