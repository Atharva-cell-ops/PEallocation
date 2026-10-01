import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPreferences() {
  const cycle = await prisma.allocationCycle.findFirst({
    where: { semester: 5 },
    include: { offerings: { include: { elective: true } } },
  });

  if (!cycle) throw new Error('Cycle not found');

  const ml = cycle.offerings.find((o) => o.elective.code === 'CS502')!;
  const cloud = cycle.offerings.find((o) => o.elective.code === 'CS501')!;
  const cyber = cycle.offerings.find((o) => o.elective.code === 'IT503')!;
  const iot = cycle.offerings.find((o) => o.elective.code === 'IT504')!;
  const fullstack = cycle.offerings.find((o) => o.elective.code === 'CS505')!;

  const students = await prisma.student.findMany({
    orderBy: { rollNumber: 'asc' },
  });

  // Student 2: Neha (8.85 CGPA) - Submitted early
  const s2 = students.find((s) => s.rollNumber === 'BT24CSE015')!;
  const s2Time = new Date('2026-10-02T09:00:00Z');
  await prisma.preference.createMany({
    data: [
      { studentId: s2.id, cycleId: cycle.id, cycleElectiveId: ml.id, rank: 1, submittedAt: s2Time },
      { studentId: s2.id, cycleId: cycle.id, cycleElectiveId: cloud.id, rank: 2, submittedAt: s2Time },
    ],
  });

  // Student 3: Rohan (8.85 CGPA) - Submitted later (10:15 AM) -> Tests tie breaker against Neha!
  const s3 = students.find((s) => s.rollNumber === 'BT24IOT008')!;
  const s3Time = new Date('2026-10-02T10:15:00Z');
  await prisma.preference.createMany({
    data: [
      { studentId: s3.id, cycleId: cycle.id, cycleElectiveId: ml.id, rank: 1, submittedAt: s3Time },
      { studentId: s3.id, cycleId: cycle.id, cycleElectiveId: iot.id, rank: 2, submittedAt: s3Time },
    ],
  });

  // Student 4: Pooja (8.20 CGPA)
  const s4 = students.find((s) => s.rollNumber === 'BT24IT022')!;
  const s4Time = new Date('2026-10-02T11:00:00Z');
  await prisma.preference.createMany({
    data: [
      { studentId: s4.id, cycleId: cycle.id, cycleElectiveId: cyber.id, rank: 1, submittedAt: s4Time },
      { studentId: s4.id, cycleId: cycle.id, cycleElectiveId: fullstack.id, rank: 2, submittedAt: s4Time },
    ],
  });

  // Student 5: Vikram (7.30 CGPA)
  const s5 = students.find((s) => s.rollNumber === 'BT24CSE042')!;
  const s5Time = new Date('2026-10-02T12:00:00Z');
  await prisma.preference.createMany({
    data: [
      { studentId: s5.id, cycleId: cycle.id, cycleElectiveId: cloud.id, rank: 1, submittedAt: s5Time },
      { studentId: s5.id, cycleId: cycle.id, cycleElectiveId: iot.id, rank: 2, submittedAt: s5Time },
    ],
  });

  // Student 6: Ananya (6.80 CGPA)
  const s6 = students.find((s) => s.rollNumber === 'BT24IOT031')!;
  const s6Time = new Date('2026-10-02T13:00:00Z');
  await prisma.preference.createMany({
    data: [
      { studentId: s6.id, cycleId: cycle.id, cycleElectiveId: iot.id, rank: 1, submittedAt: s6Time },
      { studentId: s6.id, cycleId: cycle.id, cycleElectiveId: fullstack.id, rank: 2, submittedAt: s6Time },
    ],
  });

  console.log('Seeded candidate preferences for students 2 through 6.');
}

seedPreferences()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
