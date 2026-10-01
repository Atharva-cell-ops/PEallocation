import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { CycleStatus } from '@prisma/client';
const preferenceItemSchema = z.object({
    cycleElectiveId: z.string().uuid('Invalid cycle elective ID'),
    rank: z.number().int().min(1, 'Rank must be at least 1'),
});
const updatePreferencesSchema = z.object({
    preferences: z.array(preferenceItemSchema).min(1, 'At least one preference must be selected'),
});
const getStudentOrThrow = async (req) => {
    const userId = req.user?.id;
    if (!userId)
        throw new AppError('Unauthorized', 401);
    const student = await prisma.student.findUnique({
        where: { userId },
    });
    if (!student) {
        throw new AppError('Student profile not found for this account', 404);
    }
    return student;
};
export const getCurrentCycle = async (req, res, next) => {
    try {
        const student = await getStudentOrThrow(req);
        const cycle = await prisma.allocationCycle.findFirst({
            where: {
                semester: student.semester,
                status: { in: [CycleStatus.OPEN, CycleStatus.CLOSED, CycleStatus.ALLOCATED, CycleStatus.PUBLISHED] },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!cycle) {
            res.status(200).json({
                success: true,
                data: null,
                message: 'No active allocation cycle found for your semester.',
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: cycle,
        });
    }
    catch (error) {
        next(error);
    }
};
export const getCycleElectives = async (req, res, next) => {
    try {
        const student = await getStudentOrThrow(req);
        const cycleId = req.params.cycleId;
        const cycle = await prisma.allocationCycle.findUnique({
            where: { id: cycleId },
        });
        if (!cycle) {
            throw new AppError('Allocation cycle not found', 404);
        }
        const offerings = await prisma.cycleElective.findMany({
            where: { cycleId },
            include: {
                elective: true,
            },
            orderBy: {
                elective: { code: 'asc' },
            },
        });
        const studentCgpa = Number(student.cgpa);
        const mappedOfferings = offerings.map((offering) => {
            const minCgpaNum = offering.minCgpa ? Number(offering.minCgpa) : null;
            const isEligible = minCgpaNum === null || studentCgpa >= minCgpaNum;
            return {
                id: offering.id,
                electiveId: offering.electiveId,
                code: offering.elective.code,
                title: offering.elective.title,
                department: offering.elective.department,
                credits: offering.elective.credits,
                description: offering.elective.description,
                maxCapacity: offering.maxCapacity,
                minCgpa: minCgpaNum,
                isEligible,
                ineligibilityReason: !isEligible
                    ? `Requires minimum CGPA of ${minCgpaNum.toFixed(2)} (Your CGPA: ${studentCgpa.toFixed(2)})`
                    : null,
            };
        });
        res.status(200).json({
            success: true,
            data: mappedOfferings,
        });
    }
    catch (error) {
        next(error);
    }
};
export const getMyPreferences = async (req, res, next) => {
    try {
        const student = await getStudentOrThrow(req);
        const cycleId = req.params.cycleId;
        const preferences = await prisma.preference.findMany({
            where: {
                cycleId,
                studentId: student.id,
            },
            include: {
                cycleElective: {
                    include: {
                        elective: true,
                    },
                },
            },
            orderBy: {
                rank: 'asc',
            },
        });
        res.status(200).json({
            success: true,
            data: preferences.map((p) => ({
                id: p.id,
                rank: p.rank,
                cycleElectiveId: p.cycleElectiveId,
                submittedAt: p.submittedAt,
                elective: {
                    code: p.cycleElective.elective.code,
                    title: p.cycleElective.elective.title,
                    department: p.cycleElective.elective.department,
                    credits: p.cycleElective.elective.credits,
                },
            })),
        });
    }
    catch (error) {
        next(error);
    }
};
export const savePreferences = async (req, res, next) => {
    try {
        const student = await getStudentOrThrow(req);
        const cycleId = req.params.cycleId;
        const { preferences } = updatePreferencesSchema.parse(req.body);
        const cycle = await prisma.allocationCycle.findUnique({
            where: { id: cycleId },
        });
        if (!cycle) {
            throw new AppError('Allocation cycle not found', 404);
        }
        if (cycle.status !== CycleStatus.OPEN) {
            throw new AppError(`Cannot submit preferences. Cycle is currently ${cycle.status}.`, 400);
        }
        if (cycle.endDate && new Date() > new Date(cycle.endDate)) {
            throw new AppError('Preference submission deadline has passed for this cycle.', 400);
        }
        const ranks = preferences.map((p) => p.rank).sort((a, b) => a - b);
        for (let i = 0; i < ranks.length; i++) {
            if (ranks[i] !== i + 1) {
                throw new AppError(`Preferences must have contiguous ranks starting from 1 with no duplicates. Expected rank ${i + 1} but found ${ranks[i]}.`, 400);
            }
        }
        const electiveIds = preferences.map((p) => p.cycleElectiveId);
        if (new Set(electiveIds).size !== electiveIds.length) {
            throw new AppError('Duplicate elective choices are not permitted.', 400);
        }
        const validOfferings = await prisma.cycleElective.findMany({
            where: {
                cycleId,
                id: { in: electiveIds },
            },
        });
        if (validOfferings.length !== electiveIds.length) {
            throw new AppError('One or more selected electives do not belong to this cycle.', 400);
        }
        const studentCgpa = Number(student.cgpa);
        for (const offering of validOfferings) {
            if (offering.minCgpa && studentCgpa < Number(offering.minCgpa)) {
                throw new AppError(`You do not satisfy the minimum CGPA prerequisite of ${Number(offering.minCgpa).toFixed(2)} for one of your selected electives.`, 400);
            }
        }
        const submissionTime = new Date();
        const result = await prisma.$transaction(async (tx) => {
            await tx.preference.deleteMany({
                where: {
                    cycleId,
                    studentId: student.id,
                },
            });
            const created = await Promise.all(preferences.map((p) => tx.preference.create({
                data: {
                    studentId: student.id,
                    cycleId,
                    cycleElectiveId: p.cycleElectiveId,
                    rank: p.rank,
                    submittedAt: submissionTime,
                },
                include: {
                    cycleElective: {
                        include: {
                            elective: true,
                        },
                    },
                },
            })));
            return created;
        });
        res.status(200).json({
            success: true,
            message: 'Preferences saved successfully.',
            data: result.map((p) => ({
                rank: p.rank,
                cycleElectiveId: p.cycleElectiveId,
                electiveCode: p.cycleElective.elective.code,
                electiveTitle: p.cycleElective.elective.title,
                submittedAt: p.submittedAt,
            })),
        });
    }
    catch (error) {
        next(error);
    }
};
export const getMyAllocationResult = async (req, res, next) => {
    try {
        const student = await getStudentOrThrow(req);
        const cycleId = req.params.cycleId;
        const cycle = await prisma.allocationCycle.findUnique({
            where: { id: cycleId },
        });
        if (!cycle) {
            throw new AppError('Allocation cycle not found', 404);
        }
        if (cycle.status !== CycleStatus.PUBLISHED) {
            res.status(200).json({
                success: true,
                published: false,
                message: 'Allocation results for this cycle have not been published by the administration yet.',
            });
            return;
        }
        const allocation = await prisma.allocation.findUnique({
            where: {
                cycleId_studentId: {
                    cycleId,
                    studentId: student.id,
                },
            },
            include: {
                cycleElective: {
                    include: {
                        elective: true,
                    },
                },
            },
        });
        if (!allocation) {
            res.status(200).json({
                success: true,
                published: true,
                status: 'UNALLOCATED',
                reason: 'No record found in the allocation run.',
            });
            return;
        }
        res.status(200).json({
            success: true,
            published: true,
            status: allocation.status,
            allocatedPreferenceRank: allocation.allocatedPreferenceRank,
            unallocatedReason: allocation.unallocatedReason,
            elective: allocation.cycleElective
                ? {
                    code: allocation.cycleElective.elective.code,
                    title: allocation.cycleElective.elective.title,
                    department: allocation.cycleElective.elective.department,
                    credits: allocation.cycleElective.elective.credits,
                }
                : null,
        });
    }
    catch (error) {
        next(error);
    }
};
