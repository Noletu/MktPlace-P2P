-- CreateTable
CREATE TABLE "WorkerState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastStartedAt" DATETIME,
    "lastStoppedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerState_workerName_key" ON "WorkerState"("workerName");

-- CreateIndex
CREATE INDEX "WorkerState_isEnabled_idx" ON "WorkerState"("isEnabled");

-- CreateIndex
CREATE INDEX "WorkerState_workerName_idx" ON "WorkerState"("workerName");
