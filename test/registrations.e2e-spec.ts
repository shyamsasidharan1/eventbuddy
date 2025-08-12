import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { UserRole } from '@prisma/client';
import * as request from 'supertest';
import { TestHelpers, createTestApp } from './test-helpers';

describe('Registrations (e2e)', () => {
  let app: INestApplication;
  let helpers: TestHelpers;
  let testOrg: any;
  let admin: any;
  let member: any;
  let staff: any;
  let testEvent: any;
  let familyMember: any;

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
    familyMember = await helpers.createTestFamilyMember(member.token, member.memberProfileId);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /registrations/events/:eventId/register', () => {
    it('should allow member to register themselves', async () => {
      const registrationData = {
        registrants: [{ type: 'member', id: member.memberProfileId }],
      };

      const response = await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${testEvent.id}/register`)
        .set('Authorization', `Bearer ${member.token}`)
        .send(registrationData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Successfully registered');
      expect(response.body).toHaveProperty('registrations');
      expect(response.body.registrations).toHaveLength(1);
    });

    it('should allow multi-person registration (member + family)', async () => {
      const response = await helpers.registerForEvent(
        member.token, 
        testEvent.id, 
        [
          { type: 'MEMBER' },
          { type: 'FAMILY_MEMBER', familyMemberId: familyMember.id },
        ]
      );

      expect(response.registrations).toHaveLength(2);
      expect(response.registrations[0]).toHaveProperty('memberId', member.memberProfileId);
      expect(response.registrations[1]).toHaveProperty('familyMemberId', familyMember.id);
    });

    it('should allow family member only registration', async () => {
      const response = await helpers.registerForEvent(
        member.token, 
        testEvent.id, 
        [{ type: 'FAMILY_MEMBER', familyMemberId: familyMember.id }]
      );

      expect(response.registrations).toHaveLength(1);
      expect(response.registrations[0]).toHaveProperty('familyMemberId', familyMember.id);
      expect(response.registrations[0].memberId).toBeNull();
    });

    it('should prevent duplicate registration for same member', async () => {
      // First registration
      const registrationData = {
        registrants: [{ type: 'member', id: member.memberProfileId }],
      };

      await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${testEvent.id}/register`)
        .set('Authorization', `Bearer ${member.token}`)
        .send(registrationData)
        .expect(201);

      // Attempt duplicate registration
      await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${testEvent.id}/register`)
        .set('Authorization', `Bearer ${member.token}`)
        .send(registrationData)
        .expect(400); // Bad Request - duplicate registration
    });

    it('should prevent duplicate registration for same family member', async () => {
      // First registration
      await helpers.registerForEvent(
        member.token, 
        testEvent.id, 
        [{ type: 'FAMILY_MEMBER', familyMemberId: familyMember.id }]
      );

      // Attempt duplicate registration
      const registrationData = {
        registrants: [
          { type: 'family', id: familyMember.id },
        ],
      };

      await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${testEvent.id}/register`)
        .set('Authorization', `Bearer ${member.token}`)
        .send(registrationData)
        .expect(400); // Bad Request - duplicate registration
    });

    it('should handle capacity limits and waitlist', async () => {
      // Create event with capacity of 1
      const smallEvent = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${admin.token}`)
        .send({
          title: 'Small Event',
          description: 'Event with capacity of 1',
          startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          location: 'Small Venue',
          capacity: 1,
          maxCapacity: 2, // Allow 1 on waitlist
          isPublic: true,
        })
        .expect(201);

      // First registration should be confirmed
      const firstReg = await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${smallEvent.body.id}/register`)
        .set('Authorization', `Bearer ${member.token}`)
        .send({
          registrants: [{ type: 'member', id: member.memberProfileId }],
        })
        .expect(201);

      expect(firstReg.body.registrations[0]).toHaveProperty('status', 'CONFIRMED');

      // Create another member for second registration
      const member2 = await helpers.createTestUser(testOrg.id, UserRole.MEMBER);

      // Second registration should be waitlisted
      const secondReg = await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${smallEvent.body.id}/register`)
        .set('Authorization', `Bearer ${member2.token}`)
        .send({
          registrants: [{ type: 'member', id: member2.memberProfileId }],
        })
        .expect(201);

      expect(secondReg.body.registrations[0]).toHaveProperty('status', 'WAITLISTED');
    });

    it('should reject registration for non-existent event', async () => {
      const registrationData = {
        registrants: [{ type: 'member', id: member.memberProfileId }],
      };

      await request(app.getHttpServer())
        .post('/api/v1/registrations/events/99999/register')
        .set('Authorization', `Bearer ${member.token}`)
        .send(registrationData)
        .expect(404);
    });

    it('should validate family member ownership', async () => {
      // Create another member with their own family member
      const member2 = await helpers.createTestUser(testOrg.id, UserRole.MEMBER);
      const familyMember2 = await helpers.createTestFamilyMember(member2.token, member2.memberProfileId);

      // Member should not be able to register someone else's family member
      const registrationData = {
        registrants: [
          { type: 'family', id: familyMember2.id },
        ],
      };

      await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${testEvent.id}/register`)
        .set('Authorization', `Bearer ${member.token}`)
        .send(registrationData)
        .expect(403);
    });
  });

  describe('GET /registrations/events/:eventId', () => {
    let registration: any;

    beforeEach(async () => {
      registration = await helpers.registerForEvent(member.token, testEvent.id, [{ type: 'MEMBER' }]);
    });

    it('should allow admin to view event registrations', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/registrations/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('registrations');
      expect(response.body.registrations).toHaveLength(1);
      expect(response.body).toHaveProperty('summary');
    });

    it('should allow staff to view event registrations', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/registrations/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('registrations');
      expect(response.body.registrations).toHaveLength(1);
    });

    it('should reject member viewing event registrations', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/registrations/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${member.token}`)
        .expect(403);
    });
  });

  describe('GET /registrations/my-registrations', () => {
    beforeEach(async () => {
      await helpers.registerForEvent(member.token, testEvent.id, [{ type: 'MEMBER' }]);
    });

    it('should allow member to view their registrations', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/registrations/my-registrations')
        .set('Authorization', `Bearer ${member.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('registrations');
      expect(response.body.registrations).toHaveLength(1);
      expect(response.body.registrations[0]).toHaveProperty('event');
      expect(response.body.registrations[0].event).toHaveProperty('title', 'Test Event');
    });

    it('should return empty array for member with no registrations', async () => {
      const member2 = await helpers.createTestUser(testOrg.id, UserRole.MEMBER);

      const response = await request(app.getHttpServer())
        .get('/api/v1/registrations/my-registrations')
        .set('Authorization', `Bearer ${member2.token}`)
        .expect(200);

      expect(response.body.registrations).toHaveLength(0);
    });
  });

  describe('POST /registrations/events/:eventId/checkin', () => {
    let registration: any;

    beforeEach(async () => {
      const regResponse = await helpers.registerForEvent(member.token, testEvent.id, [{ type: 'MEMBER' }]);
      registration = regResponse.registrations[0];
    });

    it('should allow staff to check in attendees', async () => {
      const checkinData = {
        registrationIds: [registration.id],
      };

      const response = await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${testEvent.id}/checkin`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send(checkinData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Successfully checked in');
    });

    it('should allow admin to check in attendees', async () => {
      const checkinData = {
        registrationIds: [registration.id],
      };

      const response = await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${testEvent.id}/checkin`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send(checkinData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject member checking in attendees', async () => {
      const checkinData = {
        registrationIds: [registration.id],
      };

      await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${testEvent.id}/checkin`)
        .set('Authorization', `Bearer ${member.token}`)
        .send(checkinData)
        .expect(403);
    });

    it('should handle multiple check-ins in one request', async () => {
      // Create another member and registration
      const member2 = await helpers.createTestUser(testOrg.id, UserRole.MEMBER);
      const regResponse2 = await helpers.registerForEvent(member2.token, testEvent.id, [{ type: 'MEMBER' }]);

      const checkinData = {
        registrationIds: [registration.id, regResponse2.registrations[0].id],
      };

      const response = await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${testEvent.id}/checkin`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send(checkinData)
        .expect(200);

      // The response structure might be different - let's check what property exists
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Successfully checked in');
    });

    it('should handle already checked in attendees', async () => {
      const checkinData = {
        registrationIds: [registration.id],
      };

      // First check-in
      await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${testEvent.id}/checkin`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send(checkinData)
        .expect(200);

      // Second check-in should still succeed but indicate already checked in
      const response = await request(app.getHttpServer())
        .post(`/api/v1/registrations/events/${testEvent.id}/checkin`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send(checkinData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });
});