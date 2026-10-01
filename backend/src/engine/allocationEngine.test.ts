import { describe, it, expect } from 'vitest';
import { runAllocationEngine, AllocationInvariantError } from './allocationEngine.js';
import { TieBreakerRule } from '@prisma/client';
import { StudentCandidate, OfferingCandidate, PreferenceCandidate } from './types.js';

describe('Professional Elective Allocation Engine', () => {
  const baseOfferings: OfferingCandidate[] = [
    { id: 'off-ml', code: 'CS502', title: 'Machine Learning', maxCapacity: 1, minCgpa: 7.5 },
    { id: 'off-cloud', code: 'CS501', title: 'Cloud Architecture', maxCapacity: 1, minCgpa: null },
    { id: 'off-iot', code: 'IT504', title: 'IoT Systems', maxCapacity: 2, minCgpa: null },
  ];

  it('allocates 1st preference when seats are available', () => {
    const students: StudentCandidate[] = [
      { id: 's1', rollNumber: 'BT01', name: 'Aarav', department: 'CSE', cgpa: 9.2 },
    ];
    const preferences: PreferenceCandidate[] = [
      { studentId: 's1', cycleElectiveId: 'off-ml', rank: 1, submittedAt: new Date() },
    ];

    const result = runAllocationEngine({
      cycleId: 'c1',
      tieBreakerRule: TieBreakerRule.SUBMISSION_TIME,
      students,
      offerings: baseOfferings,
      preferences,
    });

    expect(result.totalAllocated).toBe(1);
    expect(result.allocated[0]).toEqual({
      studentId: 's1',
      cycleElectiveId: 'off-ml',
      rank: 1,
      cgpa: 9.2,
    });
  });

  it('falls back to 2nd preference when 1st is full', () => {
    const students: StudentCandidate[] = [
      { id: 's1', rollNumber: 'BT01', name: 'Aarav', department: 'CSE', cgpa: 9.5 },
      { id: 's2', rollNumber: 'BT02', name: 'Neha', department: 'CSE', cgpa: 8.8 },
    ];

    // Both want ML (Capacity 1) as rank 1; Neha has Cloud as rank 2
    const preferences: PreferenceCandidate[] = [
      { studentId: 's1', cycleElectiveId: 'off-ml', rank: 1, submittedAt: new Date() },
      { studentId: 's2', cycleElectiveId: 'off-ml', rank: 1, submittedAt: new Date() },
      { studentId: 's2', cycleElectiveId: 'off-cloud', rank: 2, submittedAt: new Date() },
    ];

    const result = runAllocationEngine({
      cycleId: 'c1',
      tieBreakerRule: TieBreakerRule.SUBMISSION_TIME,
      students,
      offerings: baseOfferings,
      preferences,
    });

    expect(result.totalAllocated).toBe(2);
    // s1 gets ML (Rank 1)
    expect(result.allocated.find((a) => a.studentId === 's1')?.cycleElectiveId).toBe('off-ml');
    // s2 gets Cloud (Rank 2) because ML was full
    const s2Allocation = result.allocated.find((a) => a.studentId === 's2');
    expect(s2Allocation?.cycleElectiveId).toBe('off-cloud');
    expect(s2Allocation?.rank).toBe(2);
  });

  it('resolves equal CGPA using earlier submission timestamp', () => {
    const timeA = new Date('2026-10-01T10:00:00Z');
    const timeB = new Date('2026-10-01T10:30:00Z'); // 30 minutes later

    const students: StudentCandidate[] = [
      { id: 's1', rollNumber: 'BT01', name: 'Neha', department: 'CSE', cgpa: 8.5 },
      { id: 's2', rollNumber: 'BT02', name: 'Rohan', department: 'IoT', cgpa: 8.5 },
    ];

    // Both tie for CGPA 8.5 and compete for 1 seat in Cloud Architecture
    const preferences: PreferenceCandidate[] = [
      { studentId: 's1', cycleElectiveId: 'off-cloud', rank: 1, submittedAt: timeA },
      { studentId: 's2', cycleElectiveId: 'off-cloud', rank: 1, submittedAt: timeB },
    ];

    const result = runAllocationEngine({
      cycleId: 'c1',
      tieBreakerRule: TieBreakerRule.SUBMISSION_TIME,
      students,
      offerings: baseOfferings,
      preferences,
    });

    expect(result.totalAllocated).toBe(1);
    expect(result.totalUnallocated).toBe(1);
    // s1 wins because timeA < timeB
    expect(result.allocated[0].studentId).toBe('s1');
    expect(result.unallocated[0].studentId).toBe('s2');
    expect(result.unallocated[0].reason).toBe('CAPACITY_EXHAUSTED');
  });

  it('skips electives where student does not satisfy minimum CGPA threshold', () => {
    const students: StudentCandidate[] = [
      { id: 's1', rollNumber: 'BT01', name: 'Vikram', department: 'CSE', cgpa: 7.2 }, // Below ML min (7.5)
    ];

    // Vikram puts ML as Rank 1 and IoT (No min CGPA) as Rank 2
    const preferences: PreferenceCandidate[] = [
      { studentId: 's1', cycleElectiveId: 'off-ml', rank: 1, submittedAt: new Date() },
      { studentId: 's1', cycleElectiveId: 'off-iot', rank: 2, submittedAt: new Date() },
    ];

    const result = runAllocationEngine({
      cycleId: 'c1',
      tieBreakerRule: TieBreakerRule.SUBMISSION_TIME,
      students,
      offerings: baseOfferings,
      preferences,
    });

    expect(result.totalAllocated).toBe(1);
    // s1 was skipped for ML and allocated IoT
    expect(result.allocated[0].cycleElectiveId).toBe('off-iot');
    expect(result.allocated[0].rank).toBe(2);
  });

  it('marks student unallocated if no preferences were submitted', () => {
    const students: StudentCandidate[] = [
      { id: 's1', rollNumber: 'BT01', name: 'Pooja', department: 'IT', cgpa: 8.0 },
    ];

    const result = runAllocationEngine({
      cycleId: 'c1',
      tieBreakerRule: TieBreakerRule.SUBMISSION_TIME,
      students,
      offerings: baseOfferings,
      preferences: [],
    });

    expect(result.totalAllocated).toBe(0);
    expect(result.totalUnallocated).toBe(1);
    expect(result.unallocated[0].reason).toBe('NO_PREFERENCES');
  });

  it('enforces that no elective can ever exceed its capacity', () => {
    const singleSeatOffering: OfferingCandidate[] = [
      { id: 'off-exclusive', code: 'CS999', title: 'Quantum Computing', maxCapacity: 1, minCgpa: null },
    ];

    const students: StudentCandidate[] = [
      { id: 's1', rollNumber: 'BT01', name: 'Student 1', department: 'CSE', cgpa: 9.0 },
      { id: 's2', rollNumber: 'BT02', name: 'Student 2', department: 'CSE', cgpa: 8.9 },
      { id: 's3', rollNumber: 'BT03', name: 'Student 3', department: 'CSE', cgpa: 8.8 },
    ];

    const preferences: PreferenceCandidate[] = [
      { studentId: 's1', cycleElectiveId: 'off-exclusive', rank: 1, submittedAt: new Date() },
      { studentId: 's2', cycleElectiveId: 'off-exclusive', rank: 1, submittedAt: new Date() },
      { studentId: 's3', cycleElectiveId: 'off-exclusive', rank: 1, submittedAt: new Date() },
    ];

    const result = runAllocationEngine({
      cycleId: 'c1',
      tieBreakerRule: TieBreakerRule.SUBMISSION_TIME,
      students,
      offerings: singleSeatOffering,
      preferences,
    });

    expect(result.totalAllocated).toBe(1);
    expect(result.totalUnallocated).toBe(2);
    expect(result.seatUtilization['off-exclusive'].allocated).toBe(1);
    expect(result.seatUtilization['off-exclusive'].capacity).toBe(1);
  });
});
