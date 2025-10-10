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
    "collateralTxHash" TEXT,
    "collateralConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "collateralDepositId" TEXT,
    "timeoutAt" DATETIME,
    "paidByPlatform" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_collateralDepositId_fkey" FOREIGN KEY ("collateralDepositId") REFERENCES "Deposit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("brlAmount", "completedAt", "createdAt", "cryptoAmount", "cryptoNetwork", "cryptoType", "id", "orderData", "paidByPlatform", "payerReward", "platformFee", "status", "timeoutAt", "totalFee", "type", "updatedAt", "userId") SELECT "brlAmount", "completedAt", "createdAt", "cryptoAmount", "cryptoNetwork", "cryptoType", "id", "orderData", "paidByPlatform", "payerReward", "platformFee", "status", "timeoutAt", "totalFee", "type", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
