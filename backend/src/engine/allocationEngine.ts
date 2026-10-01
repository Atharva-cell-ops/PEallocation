import {
  EngineInput,
  EngineOutput,
  AllocatedResult,
  UnallocatedResult,
  OfferingCandidate,
} from './types.js';
import { TieBreakerRule } from '@prisma/client';

export class AllocationInvariantError extends Error {
  constructor(message: string) {
    super(`[INVARIANT VIOLATION]: ${message}`);
    this.name = 'AllocationInvariantError';
  }
}

export const runAllocationEngine = (input: EngineInput): EngineOutput => {
  const { cycleId, tieBreakerRule, students, offerings, preferences } = input;
  const executionLog: string[] = [];

  executionLog.push(
    `Starting allocation for Cycle ${cycleId} with ${students.length} students and ${offerings.length} offerings.`
  );
  executionLog.push(`Tie-breaker rule: ${tieBreakerRule}`);

  // 1. Build lookup tables and seat ledgers
  const offeringMap = new Map<string, OfferingCandidate>();
  const seatLedger = new Map<string, number>();

  for (const offering of offerings) {
    offeringMap.set(offering.id, offering);
    seatLedger.set(offering.id, offering.maxCapacity);
  }

  // 2. Map preferences per student (sorted by rank ascending)
  const studentPrefsMap = new Map<string, typeof preferences>();
  for (const pref of preferences) {
    const list = studentPrefsMap.get(pref.studentId) || [];
    list.push(pref);
    studentPrefsMap.set(pref.studentId, list);
  }

  for (const [studentId, list] of studentPrefsMap.entries()) {
    list.sort((a, b) => a.rank - b.rank);
  }

  // 3. Sort students by CGPA descending, then tie-breaker
  const sortedStudents = [...students].sort((a, b) => {
    // Primary: CGPA Descending
    if (b.cgpa !== a.cgpa) {
      return b.cgpa - a.cgpa;
    }

    // Secondary: Institutional Tie-Breaker
    if (tieBreakerRule === TieBreakerRule.SUBMISSION_TIME) {
      const aPrefs = studentPrefsMap.get(a.id);
      const bPrefs = studentPrefsMap.get(b.id);
      const aTime = aPrefs && aPrefs.length > 0 ? aPrefs[0].submittedAt.getTime() : Infinity;
      const bTime = bPrefs && bPrefs.length > 0 ? bPrefs[0].submittedAt.getTime() : Infinity;
      if (aTime !== bTime) {
        return aTime - bTime; // Earlier submission wins
      }
    }

    // Fallback or explicit ROLL_NUMBER rule: Lexicographical order
    return a.rollNumber.localeCompare(b.rollNumber);
  });

  const allocated: AllocatedResult[] = [];
  const unallocated: UnallocatedResult[] = [];

  // 4. Sequential Merit Dictatorship
  for (const student of sortedStudents) {
    const studentPrefs = studentPrefsMap.get(student.id) || [];

    if (studentPrefs.length === 0) {
      unallocated.push({
        studentId: student.id,
        cgpa: student.cgpa,
        reason: 'NO_PREFERENCES',
      });
      executionLog.push(
        `Student ${student.rollNumber} (CGPA: ${student.cgpa}) marked UNALLOCATED: No preferences submitted.`
      );
      continue;
    }

    let isAssigned = false;

    for (const pref of studentPrefs) {
      const offering = offeringMap.get(pref.cycleElectiveId);
      if (!offering) continue;

      // Check offering eligibility (e.g. minimum CGPA prerequisite)
      if (offering.minCgpa !== null && student.cgpa < offering.minCgpa) {
        executionLog.push(
          `Student ${student.rollNumber} skipped for ${offering.code}: CGPA ${student.cgpa} < Min ${offering.minCgpa}.`
        );
        continue;
      }

      // Check available capacity
      const remainingSeats = seatLedger.get(offering.id) ?? 0;
      if (remainingSeats > 0) {
        seatLedger.set(offering.id, remainingSeats - 1);
        allocated.push({
          studentId: student.id,
          cycleElectiveId: offering.id,
          rank: pref.rank,
          cgpa: student.cgpa,
        });
        isAssigned = true;
        executionLog.push(
          `Student ${student.rollNumber} allocated ${offering.code} (Preference #${pref.rank}). Remaining seats: ${remainingSeats - 1}.`
        );
        break; // Exactly one elective allocated
      }
    }

    if (!isAssigned) {
      unallocated.push({
        studentId: student.id,
        cgpa: student.cgpa,
        reason: 'CAPACITY_EXHAUSTED',
      });
      executionLog.push(
        `Student ${student.rollNumber} marked UNALLOCATED: All submitted preferences are at full capacity.`
      );
    }
  }

  // 5. Hard Invariant Assertions before returning
  const assignedStudentIds = new Set<string>();
  for (const item of allocated) {
    if (assignedStudentIds.has(item.studentId)) {
      throw new AllocationInvariantError(
        `Duplicate assignment detected: Student ${item.studentId} was allocated multiple electives.`
      );
    }
    assignedStudentIds.add(item.studentId);
  }

  const seatsUsed = new Map<string, number>();
  for (const item of allocated) {
    seatsUsed.set(item.cycleElectiveId, (seatsUsed.get(item.cycleElectiveId) || 0) + 1);
  }

  const seatUtilization: Record<string, { code: string; allocated: number; capacity: number }> = {};
  for (const offering of offerings) {
    const count = seatsUsed.get(offering.id) || 0;
    if (count > offering.maxCapacity) {
      throw new AllocationInvariantError(
        `Seat overflow: Elective ${offering.code} allocated ${count} seats, exceeding capacity ${offering.maxCapacity}.`
      );
    }
    seatUtilization[offering.id] = {
      code: offering.code,
      allocated: count,
      capacity: offering.maxCapacity,
    };
  }

  if (allocated.length + unallocated.length !== students.length) {
    throw new AllocationInvariantError(
      `Accounting mismatch: Total processed (${allocated.length + unallocated.length}) does not match student pool (${students.length}).`
    );
  }

  return {
    cycleId,
    tieBreakerApplied: tieBreakerRule,
    totalEligible: students.length,
    totalAllocated: allocated.length,
    totalUnallocated: unallocated.length,
    allocated,
    unallocated,
    seatUtilization,
    executionLog,
  };
};
