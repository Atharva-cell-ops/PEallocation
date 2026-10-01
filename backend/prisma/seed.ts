import { PrismaClient, Role, CycleStatus, TieBreakerRule } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Database Seeding ---');

  await prisma.auditLog.deleteMany();
  await prisma.allocation.deleteMany();
  await prisma.allocationRun.deleteMany();
  await prisma.preference.deleteMany();
  await prisma.cycleElective.deleteMany();
  await prisma.elective.deleteMany();
  await prisma.allocationCycle.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();

  console.log('Cleared existing records.');

  const adminPassword = await argon2.hash('Admin@123');
  const studentPassword = await argon2.hash('Student@123');

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@college.edu',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });
  console.log(`Created Admin: ${adminUser.email}`);

  const electivesData = [
    {
      code: 'CS501',
      title: 'Cloud Computing Architecture',
      department: 'CSE',
      credits: 3,
      description: 'Distributed cloud architectures, virtualization, serverless computing, and AWS/Azure design patterns.',
    },
    {
      code: 'CS502',
      title: 'Applied Machine Learning',
      department: 'CSE',
      credits: 3,
      description: 'Supervised and unsupervised learning pipelines, model evaluation, neural networks, and Scikit-Learn.',
    },
    {
      code: 'IT503',
      title: 'Cyber Security & Digital Forensics',
      department: 'IT',
      credits: 3,
      description: 'Network vulnerabilities, penetration testing, cryptographic protocols, and incident response.',
    },
    {
      code: 'IT504',
      title: 'Internet of Things Systems',
      department: 'IoT',
      credits: 3,
      description: 'Embedded microcontrollers, sensor integration, MQTT protocols, and edge compute nodes.',
    },
    {
      code: 'CS505',
      title: 'Full-Stack Enterprise Architecture',
      department: 'CSE',
      credits: 3,
      description: 'Scalable web systems, microservices design, caching layers, and high-concurrency database patterns.',
    },
  ];

  const createdElectives = [];
  for (const item of electivesData) {
    const el = await prisma.elective.create({ data: item });
    createdElectives.push(el);
  }

  const cycle = await prisma.allocationCycle.create({
    data: {
      name: 'Autumn 2026 - B.Tech Semester 5 PE-I',
      academicYear: '2026-27',
      semester: 5,
      status: CycleStatus.OPEN,
      startDate: new Date('2026-10-01T00:00:00Z'),
      endDate: new Date('2026-10-15T23:59:59Z'),
      tieBreakerRule: TieBreakerRule.SUBMISSION_TIME,
    },
  });

  const seatCapacities = [2, 2, 1, 2, 1];
  for (let i = 0; i < createdElectives.length; i++) {
    await prisma.cycleElective.create({
      data: {
        cycleId: cycle.id,
        electiveId: createdElectives[i].id,
        maxCapacity: seatCapacities[i],
        minCgpa: i === 1 ? 7.5 : null,
      },
    });
  }

  const studentsSeed = [
    { name: 'Aarav Sharma', roll: 'BT24CSE001', dept: 'CSE', sem: 5, cgpa: 9.45 },
    { name: 'Neha Deshmukh', roll: 'BT24CSE015', dept: 'CSE', sem: 5, cgpa: 8.85 },
    { name: 'Rohan Kulkarni', roll: 'BT24IOT008', dept: 'IoT', sem: 5, cgpa: 8.85 },
    { name: 'Pooja Iyer', roll: 'BT24IT022', dept: 'IT', sem: 5, cgpa: 8.20 },
    { name: 'Vikram Verma', roll: 'BT24CSE042', dept: 'CSE', sem: 5, cgpa: 7.30 },
    { name: 'Ananya Patil', roll: 'BT24IOT031', dept: 'IoT', sem: 5, cgpa: 6.80 },
  ];

  for (let i = 0; i < studentsSeed.length; i++) {
    const st = studentsSeed[i];
    const user = await prisma.user.create({
      data: {
        email: `student${i + 1}@college.edu`,
        passwordHash: studentPassword,
        role: Role.STUDENT,
      },
    });

    await prisma.student.create({
      data: {
        userId: user.id,
        rollNumber: st.roll,
        name: st.name,
        department: st.dept,
        semester: st.sem,
        cgpa: st.cgpa,
      },
    });
  }

  console.log('--- Database Seeding Completed Successfully ---');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
