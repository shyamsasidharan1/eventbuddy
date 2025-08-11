import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { UserRole, MembershipCategory } from '@prisma/client';
import * as request from 'supertest';
import { TestHelpers, createTestApp } from './test-helpers';

describe('Full Integration Workflow (e2e)', () => {
  let app: INestApplication;
  let helpers: TestHelpers;
  let testOrg: any;

  beforeAll(async () => {
    app = await createTestApp();
    helpers = new TestHelpers(app);
  });

  beforeEach(async () => {
    await helpers.cleanup();
    testOrg = await helpers.createTestOrganization();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete EventBuddy Workflow', () => {
    it('should handle complete organization setup and event lifecycle', async () => {
      // 1. Bootstrap super admin
      const bootstrapResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/bootstrap-super-admin')
        .send({
          email: 'superadmin@eventbuddy.test',
          password: 'superadmin123',
          orgId: testOrg.id,
        })
        .expect(201);

      expect(bootstrapResponse.body).toHaveProperty('role', 'ORG_ADMIN');

      // 2. Login as super admin
      const adminLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'superadmin@eventbuddy.test',
          password: 'superadmin123',
        })
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      const adminToken = adminLogin.body.access_token;

      // 3. Create staff user via admin delegation
      const staffCreation = await request(app.getHttpServer())
        .post('/api/v1/auth/create-admin')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'staff@eventbuddy.test',
          password: 'staff123',
          role: UserRole.EVENT_STAFF,
          firstName: 'Event',
          lastName: 'Staff',
          phone: '555-STAFF',
          membershipCategory: MembershipCategory.REGULAR,
        })
        .expect(201);

      expect(staffCreation.body).toHaveProperty('role', 'EVENT_STAFF');

      // 4. Staff login
      const staffLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'staff@eventbuddy.test',
          password: 'staff123',
        })
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      const staffToken = staffLogin.body.access_token;

      // 5. Member registration
      const memberRegistration = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'member@eventbuddy.test',
          password: 'member123',
          orgId: testOrg.id.toString(),
          firstName: 'Regular',
          lastName: 'Member',
          phone: '555-MEMBER',
          membershipCategory: MembershipCategory.PREMIUM,
          membershipFee: '200.00',
        })
        .expect(201);

      // 6. Member login
      const memberLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'member@eventbuddy.test',
          password: 'member123',
        })
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      const memberToken = memberLogin.body.access_token;
      const memberProfile = memberLogin.body.user.memberProfile;

      // 7. Member adds family member
      const familyMemberCreation = await request(app.getHttpServer())
        .post(`/api/v1/members/${memberProfile.id}/family`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          firstName: 'Family',
          lastName: 'Member',
          dateOfBirth: '1985-05-15',
          gender: 'Female',
          relationship: 'spouse',
          notes: 'Test family member',
        })
        .expect(201);

      const familyMember = familyMemberCreation.body;

      // 8. Admin creates event
      const eventCreation = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Annual Charity Gala',
          description: 'Our biggest fundraising event of the year',
          startsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
          location: 'Grand Ballroom, City Hotel',
          capacity: 100,
          maxCapacity: 120,
          isPublic: true,
        })
        .expect(201);

      const event = eventCreation.body;

      // 9. Member registers for event (multi-person)
      const registration = await helpers.registerForEvent(
        memberToken,
        event.id,
        [
          { type: 'MEMBER' },
          { type: 'FAMILY_MEMBER', familyMemberId: familyMember.id },
        ]
      );

      expect(registration.registrations).toHaveLength(2);
      expect(registration.registrations[0].status).toBe('CONFIRMED');
      expect(registration.registrations[1].status).toBe('CONFIRMED');

      // 10. Staff checks event registrations
      const eventRegistrations = await request(app.getHttpServer())
        .get(`/api/v1/registrations/events/${event.id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(eventRegistrations.body.registrations).toHaveLength(2);

      // 11. Staff performs check-in at event
      const checkin = await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${event.id}/checkin`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          registrationIds: registration.registrations.map((r: any) => r.id),
        })
        .expect(200);

      expect(checkin.body).toHaveProperty('message');
      expect(checkin.body.message).toContain('Successfully checked in');

      // 12. Admin views comprehensive reports
      const dashboard = await request(app.getHttpServer())
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(dashboard.body.membership.totalMembers).toBe(3); // super admin + staff + member
      expect(dashboard.body.membership.totalFamilyMembers).toBe(1);
      expect(dashboard.body.registrations.totalRegistrations).toBe(2);
      expect(dashboard.body.registrations.checkedInCount).toBe(2);
      expect(dashboard.body.attendance.totalEvents).toBe(1);
      expect(dashboard.body.attendance.overallAttendanceRate).toBe(100);

      // 13. Export reports to CSV
      const membershipCSV = await request(app.getHttpServer())
        .get('/api/v1/reports/membership?format=csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(membershipCSV.header['content-type']).toContain('text/csv');
      expect(membershipCSV.text).toContain('Regular');
      expect(membershipCSV.text).toContain('PREMIUM');

      const registrationsCSV = await request(app.getHttpServer())
        .get('/api/v1/reports/registrations?format=csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(registrationsCSV.header['content-type']).toContain('text/csv');
      expect(registrationsCSV.text).toContain('Annual Charity Gala');

      // 14. Financial reporting (admin only)
      const financial = await request(app.getHttpServer())
        .get('/api/v1/reports/financial')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(financial.body.summary.totalActiveMembers).toBe(3);
      expect(financial.body.summary.totalAnnualRevenue).toBeGreaterThan(0);

      // 15. Verify staff cannot access financial reports
      await request(app.getHttpServer())
        .get('/api/v1/reports/financial')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);

      // 16. Verify member cannot create events
      await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Unauthorized Event',
          description: 'This should fail',
          startsAt: new Date().toISOString(),
          endsAt: new Date().toISOString(),
          location: 'Anywhere',
          capacity: 10,
        })
        .expect(403);

      // 17. Test event capacity limits
      const smallEvent = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Small Workshop',
          description: 'Limited capacity workshop',
          startsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          endsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          location: 'Small Room',
          capacity: 1,
          maxCapacity: 2,
          isPublic: true,
        })
        .expect(201);

      // Member registers (should be confirmed)  
      const smallEventReg1 = await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${smallEvent.body.id}/register`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          registrants: [{ type: 'member', id: memberProfile.id }],
        })
        .expect(201);

      expect(smallEventReg1.body.registrations[0].status).toBe('CONFIRMED');

      // Create second member
      const member2Registration = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'member2@eventbuddy.test',
          password: 'member123',
          orgId: testOrg.id.toString(),
          firstName: 'Second',
          lastName: 'Member',
          phone: '555-MEMBER2',
        })
        .expect(201);

      const member2Login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'member2@eventbuddy.test',
          password: 'member123',
        })
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      const member2Token = member2Login.body.access_token;

      // Second member registers (should be waitlisted)
      const member2Profile = member2Login.body.user.memberProfile;
      const smallEventReg2 = await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${smallEvent.body.id}/register`)
        .set('Authorization', `Bearer ${member2Token}`)
        .send({
          registrants: [{ type: 'member', id: member2Profile.id }],
        })
        .expect(201);

      expect(smallEventReg2.body.registrations[0].status).toBe('WAITLISTED');

      // 18. Check event capacity
      const capacity = await request(app.getHttpServer())
        .get(`/api/v1/events/${smallEvent.body.id}/capacity`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(capacity.body.currentRegistrations).toBe(1); // Only confirmed registrations counted
      expect(capacity.body.availableSpots).toBe(0);
      expect(capacity.body.canWaitlist).toBe(true);
    });

    it('should handle business rule violations correctly', async () => {
      // Setup basic users
      const admin = await helpers.createTestUser(testOrg.id, UserRole.ORG_ADMIN);
      const member = await helpers.createTestUser(testOrg.id, UserRole.MEMBER);

      // Test duplicate registration prevention
      const event = await helpers.createTestEvent(admin.token, testOrg.id);
      
      // First registration should succeed
      await helpers.registerForEvent(member.token, event.id, [{ type: 'MEMBER' }]);

      // Duplicate registration should fail
      await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${event.id}/register`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({
          registrants: [{ type: 'member', id: member.memberProfileId }],
        })
        .expect(400); // Bad Request - duplicate registration

      // Test family member ownership validation
      const member2 = await helpers.createTestUser(testOrg.id, UserRole.MEMBER);
      const familyMember2 = await helpers.createTestFamilyMember(member2.token, member2.memberProfileId);

      // Member should not be able to register someone else's family member
      await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${event.id}/register`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({
          registrants: [{ type: 'family', id: familyMember2.id }],
        })
        .expect(403);
    });
  });
});