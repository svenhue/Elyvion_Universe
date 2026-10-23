-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('ts', 'py');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('healthy', 'unhealthy', 'unknown');

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ModuleType" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "routePrefix" TEXT NOT NULL,
    "healthCheckUrl" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" "ModuleStatus" NOT NULL DEFAULT 'unknown',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modules_name_key" ON "modules"("name");
