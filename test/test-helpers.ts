import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/config/prisma.service';
import { UserRole, MembershipCategory } from '@prisma/client';
import * as request from 'supertest';

export interface TestUser {
  id: number;
  email: string;
  token: string;
  role: UserRole;
  memberProfileId: number;
}

export interface TestOrganization {
  id: number;
  name: string;
  webUrl: string;
}

export class TestHelpers {
  private app: INestApplication;
  private prisma: PrismaService;

  constructor(app: INestApplication) {
    this.app = app;
    this.prisma = app.get<PrismaService>(PrismaService);
  }

  async createTestOrganization(): Promise<TestOrganization> {
    const timestamp = Date.now();
    const org = await this.prisma.organization.create({
      data: {
        name: `Test Organization ${timestamp}`,
        webUrl: `test-${timestamp}.eventbuddy.com`,
        settings: {},
        isActive: true,
        updatedAt: new Date(),
      },
    });

    return {
      id: org.id,
      name: org.name,
      webUrl: org.webUrl,
    };
  }

  async createTestUser(
    orgId: number,
    role: UserRole = UserRole.MEMBER,
    membershipCategory: MembershipCategory = MembershipCategory.REGULAR
  ): Promise<TestUser> {
    const email = `test-${role.toLowerCase()}-${Date.now()}@eventbuddy.test`;
    const password = 'testpassword123';

    // Create user account
    const user = await this.prisma.userAccount.create({
      data: {
        email,
        passwordHash: '$2b$12$TAQ7HJuRE/TwYS6yRvkUueBr8Ggrsy83fMPpDX3s96Ui9fn52hW2m', // 'testpassword123'
        role,
        orgId,
        isActive: true,
      },
    });

    // Create member profile
    const memberProfile = await this.prisma.memberProfile.create({
      data: {
        userId: user.id,
        orgId,
        firstName: 'Test',
        lastName: role,
        phone: '555-0123',
        membershipCategory,
        membershipFee: membershipCategory === MembershipCategory.LIFE ? 500.0 : 100.0,
        membershipStartDate: new Date(),
        nextPaymentDue: membershipCategory === MembershipCategory.LIFE ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        emergencyContact: {},
        metadata: {},
        isActive: true,
      },
    });

    // Login to get token
    const loginResponse = await request(this.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect((res) => {
        expect([200, 201]).toContain(res.status);
      });

    return {
      id: user.id,
      email: user.email,
      token: loginResponse.body.access_token,
      role: user.role,
      memberProfileId: memberProfile.id,
    };
  }

  async createTestEvent(creatorToken: string, orgId: number): Promise<any> {
    const eventData = {
      title: 'Test Event',
      description: 'Test event for automated testing',
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), // 2 hours later
      location: 'Test Venue',
      capacity: 50,
      maxCapacity: 60,
      isPublic: true,
    };

    const response = await request(this.app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${creatorToken}`)
      .send(eventData)
      .expect(201);

    return response.body;
  }

  async createTestFamilyMember(memberToken: string, memberId: number): Promise<any> {
    const familyData = {
      firstName: 'Family',
      lastName: 'Member',
      dateOfBirth: '1985-05-15',
      gender: 'Female',
      relationship: 'spouse',
      notes: 'Test family member',
    };

    const response = await request(this.app.getHttpServer())
      .post(`/api/v1/members/${memberId}/family`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send(familyData)
      .expect(201);

    return response.body;
  }

  async registerForEvent(
    userToken: string,
    eventId: number,
    registrations: Array<{ type: 'MEMBER' | 'FAMILY_MEMBER'; familyMemberId?: number }>,
    memberProfileId?: number
  ): Promise<any> {
    // We need the member profile ID for MEMBER registrations
    if (!memberProfileId && registrations.some(r => r.type === 'MEMBER')) {
      // Get it from the token by looking up the user
      const loginResponse = await request(this.app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      memberProfileId = loginResponse.body.memberProfile.id;
    }

    const registrationData = {
      registrants: registrations.map(reg => {
        if (reg.type === 'MEMBER') {
          return { 
            type: 'member',  // Use the enum value
            id: memberProfileId 
          };
        } else {
          return { 
            type: 'family',  // Use the enum value
            id: reg.familyMemberId 
          };
        }
      }),
    };

    const response = await request(this.app.getHttpServer())
      .post(`/api/v1/registrations/events/${eventId}/register`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(registrationData)
      .expect(201);

    return response.body;
  }

  // Helper to assert error responses
  async expectError(requestPromise: Promise<request.Response>, expectedStatus: number, expectedMessage?: string) {
    const response = await requestPromise;
    expect(response.status).toBe(expectedStatus);
    
    if (expectedMessage) {
      expect(response.body.message).toContain(expectedMessage);
    }
    
    return response;
  }

  // Helper to clean up test data
  async cleanup() {
    await this.prisma.registration.deleteMany();
    await this.prisma.event.deleteMany();
    await this.prisma.familyMember.deleteMany();
    await this.prisma.memberProfile.deleteMany();
    await this.prisma.userAccount.deleteMany();
    await this.prisma.organization.deleteMany();
  }
}

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  
  // Apply the same configuration as main.ts
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));

  app.setGlobalPrefix('api/v1');
  
  await app.init();
  return app;
}