-- CreateEnum
CREATE TYPE "TargetSource" AS ENUM ('registry_module', 'deployment', 'manual');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('up', 'down');

-- CreateTable
CREATE TABLE "HealthTarget" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" "TargetSource" NOT NULL DEFAULT 'manual',
    "checkIntervalSeconds" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheckResult" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "HealthStatus" NOT NULL,
    "responseTimeMs" INTEGER,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HealthTarget_name_key" ON "HealthTarget"("name");

-- CreateIndex
CREATE INDEX "HealthCheckResult_targetId_idx" ON "HealthCheckResult"("targetId");

-- CreateIndex
CREATE INDEX "HealthCheckResult_checkedAt_idx" ON "HealthCheckResult"("checkedAt");

-- AddForeignKey
ALTER TABLE "HealthCheckResult" ADD CONSTRAINT "HealthCheckResult_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "HealthTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
