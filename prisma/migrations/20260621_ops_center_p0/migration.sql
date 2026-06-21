CREATE TYPE "OpsTaskStatus" AS ENUM ('pending', 'running', 'succeeded', 'failed', 'cancelled');

CREATE TYPE "OpsTaskType" AS ENUM (
  'h5_landing_check',
  'mini_program_check',
  'trip_booking_check',
  'sku_health_check',
  'attribution_check',
  'generic_callback'
);

CREATE TABLE "OpsAccount" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpsAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsTask" (
  "id" TEXT NOT NULL,
  "accountId" TEXT,
  "type" "OpsTaskType" NOT NULL,
  "status" "OpsTaskStatus" NOT NULL DEFAULT 'pending',
  "title" TEXT NOT NULL,
  "payload" JSONB,
  "result" JSONB,
  "callbackUrl" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "OpsTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OpsExecutionLog" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'info',
  "message" TEXT NOT NULL,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpsExecutionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OpsAccount_provider_idx" ON "OpsAccount"("provider");
CREATE INDEX "OpsAccount_status_idx" ON "OpsAccount"("status");
CREATE INDEX "OpsTask_accountId_idx" ON "OpsTask"("accountId");
CREATE INDEX "OpsTask_type_idx" ON "OpsTask"("type");
CREATE INDEX "OpsTask_status_idx" ON "OpsTask"("status");
CREATE INDEX "OpsTask_createdAt_idx" ON "OpsTask"("createdAt");
CREATE INDEX "OpsExecutionLog_taskId_idx" ON "OpsExecutionLog"("taskId");
CREATE INDEX "OpsExecutionLog_level_idx" ON "OpsExecutionLog"("level");
CREATE INDEX "OpsExecutionLog_createdAt_idx" ON "OpsExecutionLog"("createdAt");

ALTER TABLE "OpsTask" ADD CONSTRAINT "OpsTask_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "OpsAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OpsExecutionLog" ADD CONSTRAINT "OpsExecutionLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
