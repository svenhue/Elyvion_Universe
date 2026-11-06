CREATE SCHEMA IF NOT EXISTS "traffic";

CREATE TYPE "traffic"."TrafficDirection" AS ENUM ('client', 'server');
CREATE TYPE "traffic"."TrafficProtocol" AS ENUM ('http', 'https');

CREATE TABLE "traffic"."TrafficEvent" (
    "id" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" "traffic"."TrafficDirection" NOT NULL,
    "protocol" "traffic"."TrafficProtocol" NOT NULL,
    "sourceService" TEXT NOT NULL,
    "targetService" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER,
    "requestBytes" INTEGER,
    "responseBytes" INTEGER,
    "durationMs" INTEGER,
    "correlationId" TEXT,
    "errorCode" TEXT,
    "errorDetail" TEXT,
    CONSTRAINT "TrafficEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TrafficEvent_observedAt_idx" ON "traffic"."TrafficEvent"("observedAt");
CREATE INDEX "TrafficEvent_sourceService_observedAt_idx" ON "traffic"."TrafficEvent"("sourceService", "observedAt");
CREATE INDEX "TrafficEvent_targetService_observedAt_idx" ON "traffic"."TrafficEvent"("targetService", "observedAt");
CREATE INDEX "TrafficEvent_statusCode_observedAt_idx" ON "traffic"."TrafficEvent"("statusCode", "observedAt");
