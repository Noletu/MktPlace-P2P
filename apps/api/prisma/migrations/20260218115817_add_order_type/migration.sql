-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "encryptedForSender" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "ivForSender" TEXT;

-- AlterTable
ALTER TABLE "DisputeMessage" ADD COLUMN "visibleTo" TEXT;

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "resolvedAt" DATETIME,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportTicket_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" TEXT,
    "isSupportMessage" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "icon" TEXT NOT NULL DEFAULT '👤',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "level" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedBy" TEXT,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "discountPercentage" INTEGER NOT NULL,
    "maxUsesPerUser" INTEGER NOT NULL,
    "expiresAt" DATETIME,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalUses" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserCoupon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "activatedAt" DATETIME,
    "deactivatedAt" DATETIME,
    "firstUsedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserCoupon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserCoupon_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "orderType" TEXT NOT NULL DEFAULT 'SELL',
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "cryptoType" TEXT NOT NULL,
    "cryptoNetwork" TEXT NOT NULL,
    "cryptoAmount" TEXT NOT NULL,
    "brlAmount" TEXT NOT NULL,
    "platformFee" TEXT NOT NULL,
    "payerReward" TEXT NOT NULL,
    "totalFee" TEXT NOT NULL,
    "appliedCouponId" TEXT,
    "appliedCouponCode" TEXT,
    "appliedCouponDiscount" INTEGER,
    "originalPlatformFee" TEXT,
    "discountAmount" TEXT,
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
    "providerId" TEXT,
    "providerWalletId" TEXT,
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
INSERT INTO "new_Order" ("awaitingDeposit", "brlAmount", "cancelReason", "cancellationNote", "cancellationReason", "cancelledAt", "cancelledBy", "collateralConfirmed", "collateralLocked", "collateralLockedAmount", "collateralSource", "collateralUnlockedAt", "completedAt", "createdAt", "cryptoAmount", "cryptoNetwork", "cryptoTransferred", "cryptoTransferredAt", "cryptoTransferredTo", "cryptoType", "customExpirationHours", "depositConfirmedAt", "depositDeadline", "id", "manualCancelOnly", "negotiatingUserId", "negotiationStartedAt", "orderData", "ownerLastActivityAt", "ownerLastSeenAt", "ownerOnline", "paidByPlatform", "payerReward", "platformFee", "refundAmount", "refundMethod", "refundNetworkFee", "refundProcessingFee", "refundStatus", "refundTxHash", "refundedAt", "status", "timeoutAt", "totalFee", "type", "updatedAt", "userId", "walletId") SELECT "awaitingDeposit", "brlAmount", "cancelReason", "cancellationNote", "cancellationReason", "cancelledAt", "cancelledBy", "collateralConfirmed", "collateralLocked", "collateralLockedAmount", "collateralSource", "collateralUnlockedAt", "completedAt", "createdAt", "cryptoAmount", "cryptoNetwork", "cryptoTransferred", "cryptoTransferredAt", "cryptoTransferredTo", "cryptoType", "customExpirationHours", "depositConfirmedAt", "depositDeadline", "id", "manualCancelOnly", "negotiatingUserId", "negotiationStartedAt", "orderData", "ownerLastActivityAt", "ownerLastSeenAt", "ownerOnline", "paidByPlatform", "payerReward", "platformFee", "refundAmount", "refundMethod", "refundNetworkFee", "refundProcessingFee", "refundStatus", "refundTxHash", "refundedAt", "status", "timeoutAt", "totalFee", "type", "updatedAt", "userId", "walletId" FROM "Order";
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
CREATE INDEX "Order_providerId_idx" ON "Order"("providerId");
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
INSERT INTO "new_User" ("accountFrozen", "cpf", "createdAt", "email", "frozenAt", "frozenBy", "frozenReason", "frozenUntil", "id", "lastCancellationAt", "legacyRole", "name", "password", "phone", "recentCancellations", "reputationScore", "roleId", "successfulTransactions", "totalCancellations", "totalTransactions", "twoFactorBackupCodes", "twoFactorEnabled", "twoFactorSecret", "twoFactorTempSecret", "updatedAt") SELECT "accountFrozen", "cpf", "createdAt", "email", "frozenAt", "frozenBy", "frozenReason", "frozenUntil", "id", "lastCancellationAt", "legacyRole", "name", "password", "phone", "recentCancellations", "reputationScore", "roleId", "successfulTransactions", "totalCancellations", "totalTransactions", "twoFactorBackupCodes", "twoFactorEnabled", "twoFactorSecret", "twoFactorTempSecret", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_cpf_key" ON "User"("cpf");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SupportTicket_createdBy_idx" ON "SupportTicket"("createdBy");

-- CreateIndex
CREATE INDEX "SupportTicket_status_idx" ON "SupportTicket"("status");

-- CreateIndex
CREATE INDEX "SupportTicket_category_idx" ON "SupportTicket"("category");

-- CreateIndex
CREATE INDEX "SupportTicket_priority_idx" ON "SupportTicket"("priority");

-- CreateIndex
CREATE INDEX "SupportTicket_createdAt_idx" ON "SupportTicket"("createdAt");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");

-- CreateIndex
CREATE INDEX "TicketMessage_authorId_idx" ON "TicketMessage"("authorId");

-- CreateIndex
CREATE INDEX "TicketMessage_createdAt_idx" ON "TicketMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");

-- CreateIndex
CREATE INDEX "Role_slug_idx" ON "Role"("slug");

-- CreateIndex
CREATE INDEX "Role_isSystem_idx" ON "Role"("isSystem");

-- CreateIndex
CREATE INDEX "Role_isActive_idx" ON "Role"("isActive");

-- CreateIndex
CREATE INDEX "Role_level_idx" ON "Role"("level");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "Permission_name_idx" ON "Permission"("name");

-- CreateIndex
CREATE INDEX "Permission_category_idx" ON "Permission"("category");

-- CreateIndex
CREATE INDEX "Permission_isCritical_idx" ON "Permission"("isCritical");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_code_idx" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_isActive_idx" ON "Coupon"("isActive");

-- CreateIndex
CREATE INDEX "Coupon_isPublic_idx" ON "Coupon"("isPublic");

-- CreateIndex
CREATE INDEX "Coupon_expiresAt_idx" ON "Coupon"("expiresAt");

-- CreateIndex
CREATE INDEX "Coupon_createdAt_idx" ON "Coupon"("createdAt");

-- CreateIndex
CREATE INDEX "UserCoupon_userId_idx" ON "UserCoupon"("userId");

-- CreateIndex
CREATE INDEX "UserCoupon_couponId_idx" ON "UserCoupon"("couponId");

-- CreateIndex
CREATE INDEX "UserCoupon_isActive_idx" ON "UserCoupon"("isActive");

-- CreateIndex
CREATE INDEX "UserCoupon_activatedAt_idx" ON "UserCoupon"("activatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserCoupon_userId_couponId_key" ON "UserCoupon"("userId", "couponId");

-- CreateIndex
CREATE INDEX "DisputeMessage_visibleTo_idx" ON "DisputeMessage"("visibleTo");
