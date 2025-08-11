import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { UserRole, MembershipCategory } from '@prisma/client';
import * as request from 'supertest';
import { TestHelpers, createTestApp } from './test-helpers';

describe('Authentication (e2e)', () => {
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

  describe('POST /auth/bootstrap-super-admin', () => {
    it('should create initial super admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/bootstrap-super-admin')
        .send({
          email: 'superadmin@test.com',
          password: 'admin123',
          orgId: testOrg.id,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', 'superadmin@test.com');
      expect(response.body).toHaveProperty('role', 'ORG_ADMIN');
      expect(response.body).toHaveProperty('message');
    });

    it('should reject if admin already exists', async () => {
      // Create first admin
      await helpers.createTestUser(testOrg.id, UserRole.ORG_ADMIN);

      // Try to create another via bootstrap
      await request(app.getHttpServer())
        .post('/api/v1/auth/bootstrap-super-admin')
        .send({
          email: 'another@test.com',
          password: 'admin123',
          orgId: testOrg.id,
        })
        .expect(401);
    });
  });

  describe('POST /auth/register', () => {
    it('should register new member with profile', async () => {
      const userData = {
        email: 'newmember@test.com',
        password: 'password123',
        orgId: testOrg.id.toString(),
        firstName: 'New',
        lastName: 'Member',
        phone: '555-1234',
        membershipCategory: MembershipCategory.REGULAR,
        membershipFee: '100.00',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', userData.email);
      expect(response.body).toHaveProperty('role', 'MEMBER');
    });

    it('should reject duplicate email', async () => {
      const userData = {
        email: 'duplicate@test.com',
        password: 'password123',
        orgId: testOrg.id.toString(),
        firstName: 'First',
        lastName: 'User',
        phone: '555-1234',
      };

      // First registration should succeed
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      // Second registration should fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(401);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const user = await helpers.createTestUser(testOrg.id);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: user.email,
          password: 'testpassword123',
        })
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', user.email);
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return user profile with valid token', async () => {
      const user = await helpers.createTestUser(testOrg.id);

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', user.id);
      expect(response.body).toHaveProperty('email', user.email);
      expect(response.body).toHaveProperty('memberProfile');
    });

    it('should reject without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });
  });

  describe('POST /auth/create-admin', () => {
    it('should allow admin to create staff user', async () => {
      const admin = await helpers.createTestUser(testOrg.id, UserRole.ORG_ADMIN);

      const staffData = {
        email: 'newstaff@test.com',
        password: 'staff123',
        role: UserRole.EVENT_STAFF,
        firstName: 'New',
        lastName: 'Staff',
        phone: '555-5678',
        membershipCategory: MembershipCategory.REGULAR,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/create-admin')
        .set('Authorization', `Bearer ${admin.token}`)
        .send(staffData)
        .expect(201);

      expect(response.body).toHaveProperty('role', 'EVENT_STAFF');
      expect(response.body).toHaveProperty('message');
    });

    it('should reject non-admin creating admin', async () => {
      const member = await helpers.createTestUser(testOrg.id, UserRole.MEMBER);

      const adminData = {
        email: 'fake@test.com',
        password: 'password',
        role: UserRole.ORG_ADMIN,
        firstName: 'Fake',
        lastName: 'Admin',
      };

      await request(app.getHttpServer())
        .post('/api/v1/auth/create-admin')
        .set('Authorization', `Bearer ${member.token}`)
        .send(adminData)
        .expect(403);
    });
  });

  describe('PUT /auth/users/:id/role', () => {
    it('should allow admin to update user role', async () => {
      const admin = await helpers.createTestUser(testOrg.id, UserRole.ORG_ADMIN);
      const member = await helpers.createTestUser(testOrg.id, UserRole.MEMBER);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/auth/users/${member.id}/role`)
        .set('Authorization', `Bearer ${admin.token}`)
        .send({ role: UserRole.EVENT_STAFF })
        .expect(200);

      expect(response.body).toHaveProperty('role', 'EVENT_STAFF');
      expect(response.body).toHaveProperty('message');
    });

    it('should reject non-admin updating roles', async () => {
      const member1 = await helpers.createTestUser(testOrg.id, UserRole.MEMBER);
      const member2 = await helpers.createTestUser(testOrg.id, UserRole.MEMBER);

      await request(app.getHttpServer())
        .put(`/api/v1/auth/users/${member2.id}/role`)
        .set('Authorization', `Bearer ${member1.token}`)
        .send({ role: UserRole.EVENT_STAFF })
        .expect(403);
    });
  });
});