import { prisma } from '../config/prisma.js';
import { runAllocationEngine } from '../engine/allocationEngine.js';
import { AppError } from '../middlewares/errorHandler.js';
import { CycleStatus, AllocationStatus } from '@prisma/client';
export const executeCycleAllocation = async (cycleId, performedByUserId) => {
    // 1. Validate Cycle Status
    const cycle = await prisma.allocationCycle.findUnique({
        where: { id: cycleId },
    });
    if (!cycle) {
        throw new AppError('Allocation cycle not found', 404);
    }
    if (cycle.status !== CycleStatus.CLOSED) {
        throw new AppError(`Cannot execute allocation. Cycle status must be CLOSED, but is currently ${cycle.status}.`, 400);
    }
    // 2. Fetch all candidates and offerings
    const students = await prisma.student.findMany({
        where: { semester: cycle.semester },
    });
    const offerings = await prisma.cycleElective.findMany({
        where: { cycleId },
        include: { elective: true },
    });
    const preferences = await prisma.preference.findMany({
        where: { cycleId },
    });
    if (students.length === 0) {
        throw new AppError('No eligible students found for this cycle semester.', 400);
    }
    if (offerings.length === 0) {
        throw new AppError('No elective offerings configured for this cycle.', 400);
    }
    // 3. Map to engine input structures
    const engineResult = runAllocationEngine({
        cycleId: cycle.id,
        tieBreakerRule: cycle.tieBreakerRule,
        students: students.map((s) => ({
            id: s.id,
            rollNumber: s.rollNumber,
            name: s.name,
            department: s.department,
            cgpa: Number(s.cgpa),
        })),
        offerings: offerings.map((o) => ({
            id: o.id,
            code: o.elective.code,
            title: o.elective.title,
            maxCapacity: o.maxCapacity,
            minCgpa: o.minCgpa ? Number(o.minCgpa) : null,
        })),
        preferences: preferences.map((p) => ({
            studentId: p.studentId,
            cycleElectiveId: p.cycleElectiveId,
            rank: p.rank,
            submittedAt: p.submittedAt,
        })),
    });
    // Student CGPA lookup map for snapshotting
    const studentCgpaMap = new Map();
    for (const s of students) {
        studentCgpaMap.set(s.id, Number(s.cgpa));
    }
    // 4. Commit results within an atomic Database Transaction
    const committedRun = await prisma.$transaction(async (tx) => {
        // Clean up any draft/unapproved allocation runs for this cycle
        await tx.allocation.deleteMany({ where: { cycleId } });
        await tx.allocationRun.deleteMany({ where: { cycleId } });
        // Create the Allocation Run Record
        const run = await tx.allocationRun.create({
            data: {
                cycleId: cycle.id,
                totalEligible: engineResult.totalEligible,
                totalAllocated: engineResult.totalAllocated,
                totalUnallocated: engineResult.totalUnallocated,
                tieBreakerApplied: engineResult.tieBreakerApplied,
                executionLog: engineResult.executionLog.join('\n'),
            },
        });
        // Bulk write allocated records
        const allocatedRows = engineResult.allocated.map((item) => ({
            runId: run.id,
            cycleId: cycle.id,
            studentId: item.studentId,
            cycleElectiveId: item.cycleElectiveId,
            status: AllocationStatus.ALLOCATED,
            allocatedPreferenceRank: item.rank,
            unallocatedReason: null,
            cgpaSnapshot: item.cgpa,
        }));
        // Bulk write unallocated records
        const unallocatedRows = engineResult.unallocated.map((item) => ({
            runId: run.id,
            cycleId: cycle.id,
            studentId: item.studentId,
            cycleElectiveId: null,
            status: AllocationStatus.UNALLOCATED,
            allocatedPreferenceRank: null,
            unallocatedReason: item.reason,
            cgpaSnapshot: studentCgpaMap.get(item.studentId) ?? 0,
        }));
        await tx.allocation.createMany({
            data: [...allocatedRows, ...unallocatedRows],
        });
        // Update cycle status to ALLOCATED
        await tx.allocationCycle.update({
            where: { id: cycle.id },
            data: { status: CycleStatus.ALLOCATED },
        });
        // Record administrative audit log
        await tx.auditLog.create({
            data: {
                action: 'EXECUTE_ALLOCATION_RUN',
                performedBy: performedByUserId,
                cycleId: cycle.id,
                details: `Allocation run executed. Allocated: ${engineResult.totalAllocated}, Unallocated: ${engineResult.totalUnallocated}.`,
            },
        });
        return run;
    });
    return {
        runId: committedRun.id,
        summary: {
            totalEligible: engineResult.totalEligible,
            totalAllocated: engineResult.totalAllocated,
            totalUnallocated: engineResult.totalUnallocated,
            seatUtilization: engineResult.seatUtilization,
        },
        executionLog: engineResult.executionLog,
    };
};
