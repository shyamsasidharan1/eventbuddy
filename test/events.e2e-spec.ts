import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { UserRole } from '@prisma/client';
import * as request from 'supertest';
import { TestHelpers, createTestApp } from './test-helpers';

describe('Events (e2e)', () => {
  let app: INestApplication;
  let helpers: TestHelpers;
  let testOrg: any;
  let admin: any;
  let member: any;
  let staff: any;

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /events', () => {
    const validEventData = {
      title: 'Test Event',
      description: 'Test event description',
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      location: 'Test Venue',
      capacity: 50,
      maxCapacity: 60,
      isPublic: true,
      registrationDeadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    };

    it('should allow admin to create event', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(validEventData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title', validEventData.title);
      expect(response.body).toHaveProperty('capacity', validEventData.capacity);
      expect(response.body).toHaveProperty('orgId', testOrg.id);
    });

    it('should reject member creating event', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${member.token}`)
        .send(validEventData)
        .expect(403);
    });

    it('should reject staff creating event', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${staff.token}`)
        .send(validEventData)
        .expect(403);
    });

    it('should validate required fields', async () => {
      const invalidData = { ...validEventData };
      delete invalidData.title;

      await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(invalidData)
        .expect(400);
    });

    it('should validate capacity constraints', async () => {
      const invalidData = {
        ...validEventData,
        capacity: 100,
        maxCapacity: 50, // maxCapacity should be >= capacity
      };

      await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(invalidData)
        .expect(400);
    });
  });

  describe('GET /events', () => {
    let testEvent: any;

    beforeEach(async () => {
      testEvent = await helpers.createTestEvent(admin.token, testOrg.id);
    });

    it('should allow all users to list events', async () => {
      // Admin can see events
      const adminResponse = await request(app.getHttpServer())
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(adminResponse.body).toHaveProperty('events');
      expect(adminResponse.body.events).toHaveLength(1);
      expect(adminResponse.body.events[0]).toHaveProperty('title', 'Test Event');

      // Member can see events
      const memberResponse = await request(app.getHttpServer())
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${member.token}`)
        .expect(200);

      expect(memberResponse.body).toHaveProperty('events');
      expect(memberResponse.body.events).toHaveLength(1);

      // Staff can see events
      const staffResponse = await request(app.getHttpServer())
        .get('/api/v1/events')
        .set('Authorization', `Bearer ${staff.token}`)
        .expect(200);

      expect(staffResponse.body).toHaveProperty('events');
      expect(staffResponse.body.events).toHaveLength(1);
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/events?page=1&limit=10')
        .set('Authorization', `Bearer ${member.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 10);
    });
  });

  describe('GET /events/stats', () => {
    it('should allow admin to get event stats', async () => {
      await helpers.createTestEvent(admin.token, testOrg.id);

      const response = await request(app.getHttpServer())
        .get('/api/v1/events/stats')
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalEvents');
      expect(response.body).toHaveProperty('upcomingEvents');
      expect(response.body).toHaveProperty('totalCapacity');
    });

    it('should allow staff to get event stats', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/events/stats')
        .set('Authorization', `Bearer ${staff.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalEvents');
    });

    it('should reject member getting event stats', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/events/stats')
        .set('Authorization', `Bearer ${member.token}`)
        .expect(403);
    });
  });

  describe('GET /events/:id', () => {
    let testEvent: any;

    beforeEach(async () => {
      testEvent = await helpers.createTestEvent(admin.token, testOrg.id);
    });

    it('should allow all users to get event details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${member.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', testEvent.id);
      expect(response.body).toHaveProperty('title', 'Test Event');
    });

    it('should return 404 for non-existent event', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/events/99999')
        .set('Authorization', `Bearer ${member.token}`)
        .expect(404);
    });
  });

  describe('GET /events/:id/capacity', () => {
    let testEvent: any;

    beforeEach(async () => {
      testEvent = await helpers.createTestEvent(admin.token, testOrg.id);
    });

    it('should return event capacity information', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/events/${testEvent.id}/capacity`)
        .set('Authorization', `Bearer ${member.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('eventId', testEvent.id);
      expect(response.body).toHaveProperty('capacity');
      expect(response.body).toHaveProperty('maxCapacity');
      expect(response.body).toHaveProperty('registeredCount');
      expect(response.body).toHaveProperty('available');
      expect(response.body).toHaveProperty('waitlistAvailable');
    });
  });

  describe('PUT /events/:id', () => {
    let testEvent: any;

    beforeEach(async () => {
      testEvent = await helpers.createTestEvent(admin.token, testOrg.id);
    });

    it('should allow admin to update event', async () => {
      const updateData = {
        title: 'Updated Event Title',
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .put(`/api/v1/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('title', 'Updated Event Title');
      expect(response.body).toHaveProperty('description', 'Updated description');
    });

    it('should reject member updating event', async () => {
      const updateData = { title: 'Hacked Event' };

      await request(app.getHttpServer())
        .put(`/api/v1/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${member.token}`)
        .send(updateData)
        .expect(403);
    });

    it('should reject staff updating event', async () => {
      const updateData = { title: 'Staff Updated Event' };

      await request(app.getHttpServer())
        .put(`/api/v1/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .send(updateData)
        .expect(403);
    });
  });

  describe('DELETE /events/:id', () => {
    let testEvent: any;

    beforeEach(async () => {
      testEvent = await helpers.createTestEvent(admin.token, testOrg.id);
    });

    it('should allow admin to delete event', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);

      // Verify event is deleted
      await request(app.getHttpServer())
        .get(`/api/v1/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(404);
    });

    it('should reject member deleting event', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${member.token}`)
        .expect(403);
    });

    it('should reject staff deleting event', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/events/${testEvent.id}`)
        .set('Authorization', `Bearer ${staff.token}`)
        .expect(403);
    });
  });
});