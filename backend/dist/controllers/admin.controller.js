import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { executeCycleAllocation } from '../services/allocationCoordinator.js';
import { CycleStatus, Role, TieBreakerRule } from '@prisma/client';
import * as argon2 from 'argon2';
const createCycleSchema = z.object({
    name: z.string().min(3, 'Cycle name is required'),
    academicYear: z.string().regex(/^\d{4}-\d{2}$/, 'Academic year must be formatted as YYYY-YY (e.g., 2026-27)'),
    semester: z.number().int().min(1).max(8),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    tieBreakerRule: z.nativeEnum(TieBreakerRule).default(TieBreakerRule.SUBMISSION_TIME),
});
const addOfferingSchema = z.object({
    electiveId: z.string().uuid('Invalid elective ID'),
    maxCapacity: z.number().int().min(1, 'Capacity must be at least 1'),
    minCgpa: z.number().min(0).max(10).nullable().optional(),
});
const importStudentsSchema = z.object({
    students: z.array(z.object({
        email: z.string().email(),
        name: z.string().min(2),
        rollNumber: z.string().min(3),
        department: z.string().min(2),
        semester: z.number().int().min(1).max(8),
        cgpa: z.number().min(0).max(10),
    })).min(1, 'Student array cannot be empty'),
});
export const getCycles = async (_req, res, next) => {
    try {
        const cycles = await prisma.allocationCycle.findMany({
            include: {
                _count: {
                    select: { offerings: true, preferences: true, allocations: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.status(200).json({ success: true, data: cycles });
    }
    catch (error) {
        next(error);
    }
};
export const createCycle = async (req, res, next) => {
    try {
        const data = createCycleSchema.parse(req.body);
        const adminId = req.user.id;
        const cycle = await prisma.$transaction(async (tx) => {
            const created = await tx.allocationCycle.create({
                data: {
                    name: data.name,
                    academicYear: data.academicYear,
                    semester: data.semester,
                    status: CycleStatus.DRAFT,
                    startDate: data.startDate ? new Date(data.startDate) : null,
                    endDate: data.endDate ? new Date(data.endDate) : null,
                    tieBreakerRule: data.tieBreakerRule,
                },
            });
            await tx.auditLog.create({
                data: {
                    action: 'CREATE_CYCLE',
                    performedBy: adminId,
                    cycleId: created.id,
                    details: `Created cycle ${created.name} for Semester ${created.semester} (${created.academicYear})`,
                },
            });
            return created;
        });
        res.status(201).json({ success: true, data: cycle });
    }
    catch (error) {
        next(error);
    }
};
export const addOfferingToCycle = async (req, res, next) => {
    try {
        const cycleId = req.params.cycleId;
        const data = addOfferingSchema.parse(req.body);
        const adminId = req.user.id;
        const cycle = await prisma.allocationCycle.findUnique({ where: { id: cycleId } });
        if (!cycle)
            throw new AppError('Cycle not found', 404);
        if (cycle.status !== CycleStatus.DRAFT && cycle.status !== CycleStatus.OPEN) {
            throw new AppError(`Cannot modify offerings while cycle is ${cycle.status}`, 400);
        }
        const offering = await prisma.$transaction(async (tx) => {
            const created = await tx.cycleElective.create({
                data: {
                    cycleId,
                    electiveId: data.electiveId,
                    maxCapacity: data.maxCapacity,
                    minCgpa: data.minCgpa !== undefined && data.minCgpa !== null ? data.minCgpa : null,
                },
                include: { elective: true },
            });
            await tx.auditLog.create({
                data: {
                    action: 'ADD_CYCLE_OFFERING',
                    performedBy: adminId,
                    cycleId,
                    details: `Added ${created.elective.code} with capacity ${data.maxCapacity} and min CGPA ${data.minCgpa ?? 'None'}`,
                },
            });
            return created;
        });
        res.status(201).json({ success: true, data: offering });
    }
    catch (error) {
        next(error);
    }
};
export const openCycle = async (req, res, next) => {
    try {
        const cycleId = req.params.cycleId;
        const adminId = req.user.id;
        const cycle = await prisma.allocationCycle.findUnique({
            where: { id: cycleId },
            include: { offerings: true },
        });
        if (!cycle)
            throw new AppError('Cycle not found', 404);
        if (cycle.status !== CycleStatus.DRAFT) {
            throw new AppError(`Cycle cannot be opened from status ${cycle.status}`, 400);
        }
        if (cycle.offerings.length === 0) {
            throw new AppError('Cannot open an allocation cycle with zero elective offerings configured.', 400);
        }
        const updated = await prisma.$transaction(async (tx) => {
            const c = await tx.allocationCycle.update({
                where: { id: cycleId },
                data: { status: CycleStatus.OPEN },
            });
            await tx.auditLog.create({
                data: {
                    action: 'OPEN_CYCLE_SUBMISSIONS',
                    performedBy: adminId,
                    cycleId,
                    details: `Opened preference submissions for cycle ${c.name}`,
                },
            });
            return c;
        });
        res.status(200).json({ success: true, data: updated, message: 'Preference submissions are now OPEN.' });
    }
    catch (error) {
        next(error);
    }
};
export const closeCycle = async (req, res, next) => {
    try {
        const cycleId = req.params.cycleId;
        const adminId = req.user.id;
        const cycle = await prisma.allocationCycle.findUnique({ where: { id: cycleId } });
        if (!cycle)
            throw new AppError('Cycle not found', 404);
        if (cycle.status !== CycleStatus.OPEN) {
            throw new AppError(`Only OPEN cycles can be closed. Current status: ${cycle.status}`, 400);
        }
        const updated = await prisma.$transaction(async (tx) => {
            const c = await tx.allocationCycle.update({
                where: { id: cycleId },
                data: { status: CycleStatus.CLOSED },
            });
            await tx.auditLog.create({
                data: {
                    action: 'CLOSE_CYCLE_SUBMISSIONS',
                    performedBy: adminId,
                    cycleId,
                    details: `Closed preference submissions for cycle ${c.name}`,
                },
            });
            return c;
        });
        res.status(200).json({ success: true, data: updated, message: 'Preference submissions are now CLOSED.' });
    }
    catch (error) {
        next(error);
    }
};
export const triggerAllocation = async (req, res, next) => {
    try {
        const cycleId = req.params.cycleId;
        const adminId = req.user.id;
        const result = await executeCycleAllocation(cycleId, adminId);
        res.status(200).json({
            success: true,
            message: 'Allocation executed and locked successfully.',
            data: result,
        });
    }
    catch (error) {
        next(error);
    }
};
export const publishCycleResults = async (req, res, next) => {
    try {
        const cycleId = req.params.cycleId;
        const adminId = req.user.id;
        const cycle = await prisma.allocationCycle.findUnique({ where: { id: cycleId } });
        if (!cycle)
            throw new AppError('Cycle not found', 404);
        if (cycle.status !== CycleStatus.ALLOCATED) {
            throw new AppError(`Cannot publish results. Cycle must be in ALLOCATED state, but is ${cycle.status}.`, 400);
        }
        const updated = await prisma.$transaction(async (tx) => {
            const c = await tx.allocationCycle.update({
                where: { id: cycleId },
                data: { status: CycleStatus.PUBLISHED },
            });
            await tx.auditLog.create({
                data: {
                    action: 'PUBLISH_RESULTS',
                    performedBy: adminId,
                    cycleId,
                    details: `Published official elective allocation results for cycle ${c.name}.`,
                },
            });
            return c;
        });
        res.status(200).json({
            success: true,
            data: updated,
            message: 'Allocation results are now PUBLISHED and visible to students.',
        });
    }
    catch (error) {
        next(error);
    }
};
export const getCycleAllocations = async (req, res, next) => {
    try {
        const cycleId = req.params.cycleId;
        const cycle = await prisma.allocationCycle.findUnique({ where: { id: cycleId } });
        if (!cycle)
            throw new AppError('Cycle not found', 404);
        const allocations = await prisma.allocation.findMany({
            where: { cycleId },
            include: {
                student: true,
                cycleElective: {
                    include: { elective: true },
                },
            },
            orderBy: [
                { student: { cgpa: 'desc' } },
                { student: { rollNumber: 'asc' } },
            ],
        });
        const offerings = await prisma.cycleElective.findMany({
            where: { cycleId },
            include: { elective: true },
        });
        const utilizationMap = {};
        for (const off of offerings) {
            utilizationMap[off.id] = {
                code: off.elective.code,
                title: off.elective.title,
                capacity: off.maxCapacity,
                assigned: 0,
            };
        }
        for (const alloc of allocations) {
            if (alloc.cycleElectiveId && utilizationMap[alloc.cycleElectiveId]) {
                utilizationMap[alloc.cycleElectiveId].assigned += 1;
            }
        }
        res.status(200).json({
            success: true,
            cycle: { id: cycle.id, name: cycle.name, status: cycle.status },
            seatUtilization: Object.values(utilizationMap),
            totalCount: allocations.length,
            allocatedCount: allocations.filter((a) => a.status === 'ALLOCATED').length,
            unallocatedCount: allocations.filter((a) => a.status === 'UNALLOCATED').length,
            allocations: allocations.map((a) => ({
                id: a.id,
                status: a.status,
                rank: a.allocatedPreferenceRank,
                unallocatedReason: a.unallocatedReason,
                student: {
                    id: a.student.id,
                    rollNumber: a.student.rollNumber,
                    name: a.student.name,
                    department: a.student.department,
                    cgpa: Number(a.cgpaSnapshot),
                },
                elective: a.cycleElective
                    ? {
                        code: a.cycleElective.elective.code,
                        title: a.cycleElective.elective.title,
                    }
                    : null,
            })),
        });
    }
    catch (error) {
        next(error);
    }
};
export const exportAllocationsCsv = async (req, res, next) => {
    try {
        const cycleId = req.params.cycleId;
        const allocations = await prisma.allocation.findMany({
            where: { cycleId },
            include: {
                student: true,
                cycleElective: {
                    include: { elective: true },
                },
            },
            orderBy: [{ student: { rollNumber: 'asc' } }],
        });
        const headers = [
            'Roll Number',
            'Student Name',
            'Department',
            'CGPA',
            'Status',
            'Allocated Preference Rank',
            'Elective Code',
            'Elective Title',
            'Unallocated Reason',
        ];
        const escapeCsv = (str) => {
            if (str === null || str === undefined)
                return '';
            const s = String(str).replace(/"/g, '""');
            return `"${s}"`;
        };
        const rows = allocations.map((a) => [
            escapeCsv(a.student.rollNumber),
            escapeCsv(a.student.name),
            escapeCsv(a.student.department),
            escapeCsv(Number(a.cgpaSnapshot).toFixed(2)),
            escapeCsv(a.status),
            escapeCsv(a.allocatedPreferenceRank ?? 'N/A'),
            escapeCsv(a.cycleElective?.elective.code ?? 'N/A'),
            escapeCsv(a.cycleElective?.elective.title ?? 'N/A'),
            escapeCsv(a.unallocatedReason ?? 'N/A'),
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="allocation-results-${cycleId}.csv"`);
        res.status(200).send(csvContent);
    }
    catch (error) {
        next(error);
    }
};
export const importStudents = async (req, res, next) => {
    try {
        const { students } = importStudentsSchema.parse(req.body);
        const defaultPassword = await argon2.hash('Student@123');
        const result = await prisma.$transaction(async (tx) => {
            let createdCount = 0;
            for (const st of students) {
                let user = await tx.user.findUnique({ where: { email: st.email } });
                if (!user) {
                    user = await tx.user.create({
                        data: {
                            email: st.email,
                            passwordHash: defaultPassword,
                            role: Role.STUDENT,
                        },
                    });
                }
                await tx.student.upsert({
                    where: { rollNumber: st.rollNumber },
                    create: {
                        userId: user.id,
                        rollNumber: st.rollNumber,
                        name: st.name,
                        department: st.department,
                        semester: st.semester,
                        cgpa: st.cgpa,
                    },
                    update: {
                        name: st.name,
                        department: st.department,
                        semester: st.semester,
                        cgpa: st.cgpa,
                    },
                });
                createdCount++;
            }
            return createdCount;
        });
        res.status(200).json({ success: true, message: `Successfully imported/updated ${result} student records.` });
    }
    catch (error) {
        next(error);
    }
};
export const getAuditLogs = async (req, res, next) => {
    try {
        const cycleId = typeof req.query.cycleId === 'string' ? req.query.cycleId : undefined;
        const logs = await prisma.auditLog.findMany({
            where: cycleId ? { cycleId } : undefined,
            include: {
                user: { select: { email: true, role: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        res.status(200).json({ success: true, data: logs });
    }
    catch (error) {
        next(error);
    }
};
