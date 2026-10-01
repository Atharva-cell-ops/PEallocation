-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'ALLOCATED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('ALLOCATED', 'UNALLOCATED');

-- CreateEnum
CREATE TYPE "TieBreakerRule" AS ENUM ('SUBMISSION_TIME', 'ROLL_NUMBER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "cgpa" DECIMAL(4,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_cycles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "tieBreakerRule" "TieBreakerRule" NOT NULL DEFAULT 'SUBMISSION_TIME',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allocation_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "electives" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 3,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "electives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_electives" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "electiveId" TEXT NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    "minCgpa" DECIMAL(4,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cycle_electives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preferences" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "cycleElectiveId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocation_runs" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalEligible" INTEGER NOT NULL,
    "totalAllocated" INTEGER NOT NULL,
    "totalUnallocated" INTEGER NOT NULL,
    "tieBreakerApplied" "TieBreakerRule" NOT NULL,
    "executionLog" TEXT,

    CONSTRAINT "allocation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allocations" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "cycleElectiveId" TEXT,
    "status" "AllocationStatus" NOT NULL,
    "allocatedPreferenceRank" INTEGER,
    "unallocatedReason" TEXT,
    "cgpaSnapshot" DECIMAL(4,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "cycleId" TEXT,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "students_userId_key" ON "students"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "students_rollNumber_key" ON "students"("rollNumber");

-- CreateIndex
CREATE INDEX "students_cgpa_idx" ON "students"("cgpa");

-- CreateIndex
CREATE INDEX "students_department_semester_idx" ON "students"("department", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "electives_code_key" ON "electives"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_electives_cycleId_electiveId_key" ON "cycle_electives"("cycleId", "electiveId");

-- CreateIndex
CREATE INDEX "preferences_cycleId_studentId_idx" ON "preferences"("cycleId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "preferences_studentId_cycleId_rank_key" ON "preferences"("studentId", "cycleId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "preferences_studentId_cycleElectiveId_key" ON "preferences"("studentId", "cycleElectiveId");

-- CreateIndex
CREATE INDEX "allocations_cycleId_cycleElectiveId_idx" ON "allocations"("cycleId", "cycleElectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "allocations_cycleId_studentId_key" ON "allocations"("cycleId", "studentId");

-- CreateIndex
CREATE INDEX "audit_logs_cycleId_idx" ON "audit_logs"("cycleId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_electives" ADD CONSTRAINT "cycle_electives_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "allocation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_electives" ADD CONSTRAINT "cycle_electives_electiveId_fkey" FOREIGN KEY ("electiveId") REFERENCES "electives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "allocation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_cycleElectiveId_fkey" FOREIGN KEY ("cycleElectiveId") REFERENCES "cycle_electives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocation_runs" ADD CONSTRAINT "allocation_runs_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "allocation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_runId_fkey" FOREIGN KEY ("runId") REFERENCES "allocation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "allocation_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_cycleElectiveId_fkey" FOREIGN KEY ("cycleElectiveId") REFERENCES "cycle_electives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "allocation_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
