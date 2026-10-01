import { TieBreakerRule } from '@prisma/client';

export interface StudentCandidate {
  id: string;
  rollNumber: string;
  name: string;
  department: string;
  cgpa: number;
}

export interface OfferingCandidate {
  id: string;
  code: string;
  title: string;
  maxCapacity: number;
  minCgpa: number | null;
}

export interface PreferenceCandidate {
  studentId: string;
  cycleElectiveId: string;
  rank: number;
  submittedAt: Date;
}

export interface EngineInput {
  cycleId: string;
  tieBreakerRule: TieBreakerRule;
  students: StudentCandidate[];
  offerings: OfferingCandidate[];
  preferences: PreferenceCandidate[];
}

export interface AllocatedResult {
  studentId: string;
  cycleElectiveId: string;
  rank: number;
  cgpa: number;
}

export interface UnallocatedResult {
  studentId: string;
  cgpa: number;
  reason: 'NO_PREFERENCES' | 'CAPACITY_EXHAUSTED';
}

export interface EngineOutput {
  cycleId: string;
  tieBreakerApplied: TieBreakerRule;
  totalEligible: number;
  totalAllocated: number;
  totalUnallocated: number;
  allocated: AllocatedResult[];
  unallocated: UnallocatedResult[];
  seatUtilization: Record<string, { code: string; allocated: number; capacity: number }>;
  executionLog: string[];
}
