import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { UserRole } from '@prisma/client';
import * as request from 'supertest';
import { TestHelpers, createTestApp } from './test-helpers';

describe('Reports (e2e)', () => {
  let app: INestApplication;
  let helpers: TestHelpers;
  let testOrg: any;
  let admin: any;
  let member: any;
  let staff: any;
  let testEvent: any;

  beforeAll(async () => {
    app = await createTestApp();
    helpers = new TestHelpers(app);
  });

  beforeEach(async () => {
    await helpers.cleanup();
    testOrg = await helpers.createTestOrganization();
    admin = await helpers.createTestUser(testOrg.id, UserRole.ORG_ADMIN);
    member = await helpers.createTestUser(testOrg.id, UserRole.MEMBER);
    staff = await helpers.createTestUser(testOrg.id, UserRole.EVENT_STAFF);
    testEvent = await helpers.createTestEvent(admin.token, testOrg.id);
    
    // Create some test data for reports
    await helpers.registerForEvent(member.token, testEvent.id, [{ type: 'MEMBER' }]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /reports/dashboard', () => {
    it('should allow admin to access dashboard', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('membership');
      expect(response.body).toHaveProperty('registrations');
      expect(response.body).toHaveProperty('attendance');
      expect(response.body).toHaveProperty('financial');
      expect(response.body).toHaveProperty('generatedAt');

      // Financial data should be included for admin
      expect(response.body.financial).not.toBeNull();
      expect(response.body.financial).toHaveProperty('totalActiveMembers');
    });

    it('should allow staff to access dashboard (without financial)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${staff.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('membership');
      expect(response.body).toHaveProperty('registrations');
      expect(response.body).toHaveProperty('attendance');
      expect(response.body).toHaveProperty('generatedAt');

      // Financial data should be null for staff
      expect(response.body.financial).toBeNull();
    });

    it('should reject member accessing dashboard', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${member.token}`)
        .expect(403);
    });
  });

  describe('GET /reports/membership', () => {
    it('should return membership report in JSON format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/membership?format=json')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('members');
      expect(response.body).toHaveProperty('generatedAt');
      expect(response.body).toHaveProperty('filters');

      expect(response.body.summary).toHaveProperty('totalMembers');
      expect(response.body.summary).toHaveProperty('activeMembers');
      expect(response.body.summary).toHaveProperty('membershipCategoryBreakdown');
      expect(response.body.summary).toHaveProperty('paymentStatus');

      expect(response.body.members).toHaveLength(2); // admin + member
    });

    it('should return membership report in CSV format', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/membership?format=csv')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.header['content-type']).toContain('text/csv');
      expect(response.header['content-disposition']).toContain('attachment');
      expect(response.header['content-disposition']).toContain('.csv');

      // Check CSV content has headers
      expect(response.text).toContain('First Name');
      expect(response.text).toContain('Last Name');
      expect(response.text).toContain('Email');
      expect(response.text).toContain('Membership Category');
    });

    it('should support filtering by membership category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/membership?membershipCategory=REGULAR')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('filters');
      expect(response.body.filters).toHaveProperty('membershipCategory', 'REGULAR');
    });

    it('should allow staff to access membership reports', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/membership')
        .set('Authorization', `Bearer ${staff.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('members');
    });

    it('should reject member accessing membership reports', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/membership')
        .set('Authorization', `Bearer ${member.token}`)
        .expect(403);
    });
  });

  describe('GET /reports/registrations', () => {
    it('should return registrations report', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/registrations')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('registrations');
      expect(response.body).toHaveProperty('generatedAt');

      expect(response.body.summary).toHaveProperty('totalRegistrations');
      expect(response.body.summary).toHaveProperty('statusBreakdown');
      expect(response.body.summary).toHaveProperty('checkedInCount');
      expect(response.body.summary).toHaveProperty('uniqueEvents');

      expect(response.body.registrations).toHaveLength(1);
    });

    it('should support CSV export', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/registrations?format=csv')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.header['content-type']).toContain('text/csv');
      expect(response.text).toContain('Registration ID');
      expect(response.text).toContain('Event Title');
      expect(response.text).toContain('Registrant Name');
    });

    it('should support filtering by event', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reports/registrations?eventId=${testEvent.id}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .expect(200);

      expect(response.body.filters).toHaveProperty('eventId', testEvent.id);
      expect(response.body.registrations).toHaveLength(1);
    });

    it('should reject member accessing registration reports', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/registrations')
        .set('Authorization', `Bearer ${member.token}`)
        .expect(403);
    });
  });

  describe('GET /reports/attendance', () => {
    it('should return attendance report', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/attendance')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('eventAttendance');
      expect(response.body).toHaveProperty('generatedAt');

      expect(response.body.summary).toHaveProperty('totalEvents');
      expect(response.body.summary).toHaveProperty('totalRegistrations');
      expect(response.body.summary).toHaveProperty('totalCheckedIn');
      expect(response.body.summary).toHaveProperty('overallAttendanceRate');
    });

    it('should support CSV export', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/attendance?format=csv')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.header['content-type']).toContain('text/csv');
      expect(response.text).toContain('Event ID');
      expect(response.text).toContain('Event Title');
      expect(response.text).toContain('Attendance Rate');
    });

    it('should allow staff to access attendance reports', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/attendance')
        .set('Authorization', `Bearer ${staff.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
    });

    it('should reject member accessing attendance reports', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/attendance')
        .set('Authorization', `Bearer ${member.token}`)
        .expect(403);
    });
  });

  describe('GET /reports/financial', () => {
    it('should allow admin to access financial reports', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/financial')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('overduePayments');
      expect(response.body).toHaveProperty('paymentsDueSoon');
      expect(response.body).toHaveProperty('allMembers');
      expect(response.body).toHaveProperty('generatedAt');

      expect(response.body.summary).toHaveProperty('totalActiveMembers');
      expect(response.body.summary).toHaveProperty('totalAnnualRevenue');
      expect(response.body.summary).toHaveProperty('overduePayments');
      expect(response.body.summary).toHaveProperty('revenueByCategory');
    });

    it('should support CSV export for financial reports', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/financial?format=csv')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.header['content-type']).toContain('text/csv');
      expect(response.text).toContain('Name');
      expect(response.text).toContain('Membership Category');
      expect(response.text).toContain('Membership Fee');
      expect(response.text).toContain('Next Payment Due');
    });

    it('should support filtering by membership category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/financial?membershipCategory=REGULAR')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.body.filters).toHaveProperty('membershipCategory', 'REGULAR');
    });

    it('should reject staff accessing financial reports', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/financial')
        .set('Authorization', `Bearer ${staff.token}`)
        .expect(403);
    });

    it('should reject member accessing financial reports', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/financial')
        .set('Authorization', `Bearer ${member.token}`)
        .expect(403);
    });
  });

  describe('Report filtering and edge cases', () => {
    it('should handle date range filtering', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const response = await request(app.getHttpServer())
        .get(`/api/v1/reports/membership?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.body.filters).toHaveProperty('startDate', startDate);
      expect(response.body.filters).toHaveProperty('endDate', endDate);
    });

    it('should handle includeInactive parameter', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/membership?includeInactive=true')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.body.filters).toHaveProperty('includeInactive', true);
    });

    it('should validate invalid format parameter', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/reports/membership?format=invalid')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(400);
    });

    it('should handle empty results gracefully', async () => {
      // Create organization with no members
      const emptyOrg = await helpers.createTestOrganization();
      const emptyAdmin = await helpers.createTestUser(emptyOrg.id, UserRole.ORG_ADMIN);

      const response = await request(app.getHttpServer())
        .get('/api/v1/reports/registrations')
        .set('Authorization', `Bearer ${emptyAdmin.token}`)
        .expect(200);

      expect(response.body.registrations).toHaveLength(0);
      expect(response.body.summary.totalRegistrations).toBe(0);
    });
  });
});