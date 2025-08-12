import { PrismaClient } from '@prisma/client';

// Global test setup
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://eventbuddy_user:eventbuddy_pass@localhost:5432/eventbuddy_test',
    },
  },
});

// Clean up database before each test
beforeEach(async () => {
  // Clean up in reverse dependency order
  await prisma.registration.deleteMany();
  await prisma.event.deleteMany();
  await prisma.familyMember.deleteMany();
  await prisma.memberProfile.deleteMany();
  await prisma.userAccount.deleteMany();
  await prisma.organization.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Make prisma available globally for tests
global.prisma = prisma;