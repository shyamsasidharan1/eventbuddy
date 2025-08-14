import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { PrismaService } from '../src/config/prisma.service'
import { EmailService } from '../src/email/email.service'
import { InvitesService } from '../src/invites/invites.service'

describe('Members Lifecycle (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let emailService: EmailService
  let invitesService: InvitesService

  // Test data
  let testOrgId: number
  let adminUserId: number
  let adminToken: string
  let invitedMemberId: number
  let inviteToken: string

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    prisma = app.get<PrismaService>(PrismaService)
    emailService = app.get<EmailService>(EmailService)
    invitesService = app.get<InvitesService>(InvitesService)

    // Mock email service to prevent actual emails during testing
    jest.spyOn(emailService, 'sendMemberInvite').mockResolvedValue(undefined)

    await app.init()

    // Setup test organization and admin user
    await setupTestData()
  })

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData()
    await app.close()
  })

  async function setupTestData() {
    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: 'Test Charity',
        webUrl: 'test-charity-lifecycle.org'
      }
    })
    testOrgId = org.id

    // Create admin user
    const adminUser = await prisma.userAccount.create({
      data: {
        orgId: testOrgId,
        email: 'admin@test-lifecycle.com',
        passwordHash: '$2b$12$test.hash', // Test hash
        role: 'ORG_ADMIN',
        isEmailVerified: true,
        isActive: true
      }
    })
    adminUserId = adminUser.id

    // Create admin member profile
    await prisma.memberProfile.create({
      data: {
        orgId: testOrgId,
        userId: adminUserId,
        firstName: 'Test',
        lastName: 'Admin',
        membershipStatus: 'ACTIVE',
        activatedAt: new Date()
      }
    })

    // Generate admin JWT token for testing
    adminToken = 'Bearer test-admin-token' // Mock token for testing
  }

  async function cleanupTestData() {
    if (testOrgId) {
      // Cleanup in reverse order of foreign key dependencies
      await prisma.auditLog.deleteMany({ where: { orgId: testOrgId } })
      await prisma.memberProfile.deleteMany({ where: { orgId: testOrgId } })
      await prisma.userAccount.deleteMany({ where: { orgId: testOrgId } })
      await prisma.organization.delete({ where: { id: testOrgId } })
    }
  }

  describe('POST /api/v1/members - Invite Member', () => {
    it('should successfully invite a new member', async () => {
      const inviteData = {
        email: 'newmember@test-lifecycle.com',
        firstName: 'John',
        lastName: 'Doe'
      }

      const response = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('Authorization', adminToken)
        .send(inviteData)
        .expect(201)

      expect(response.body).toMatchObject({
        success: true,
        message: 'Member invitation sent successfully',
        member: {
          email: 'newmember@test-lifecycle.com',
          firstName: 'John',
          lastName: 'Doe',
          membershipStatus: 'INVITED'
        }
      })

      // Verify member was created in database with INVITED status
      const createdMember = await prisma.memberProfile.findFirst({
        where: {
          orgId: testOrgId,
          firstName: 'John',
          lastName: 'Doe'
        },
        include: { user: true }
      })

      expect(createdMember).toBeTruthy()
      expect(createdMember!.membershipStatus).toBe('INVITED')
      expect(createdMember!.invitedAt).toBeTruthy()
      expect(createdMember!.user.email).toBe('newmember@test-lifecycle.com')
      expect(createdMember!.user.isEmailVerified).toBe(false)

      // Store for next tests
      invitedMemberId = createdMember!.id

      // Verify audit log was created
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          orgId: testOrgId,
          action: 'INVITE_SENT',
          targetType: 'Member',
          targetId: invitedMemberId
        }
      })

      expect(auditLog).toBeTruthy()
      expect(auditLog!.payload).toMatchObject({
        invitedEmail: 'newmember@test-lifecycle.com',
        memberId: invitedMemberId
      })

      // Verify email service was called
      expect(emailService.sendMemberInvite).toHaveBeenCalledWith({
        to: 'newmember@test-lifecycle.com',
        firstName: 'John',
        token: expect.any(String),
        orgId: testOrgId
      })
    })

    it('should return error for duplicate invitation', async () => {
      const inviteData = {
        email: 'newmember@test-lifecycle.com', // Same email as above
        firstName: 'Jane',
        lastName: 'Smith'
      }

      await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('Authorization', adminToken)
        .send(inviteData)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('already been invited')
        })
    })
  })

  describe('GET /api/v1/members?status=INVITED', () => {
    it('should list invited members', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/members?status=INVITED')
        .set('Authorization', adminToken)
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0]).toMatchObject({
        id: invitedMemberId,
        firstName: 'John',
        lastName: 'Doe',
        membershipStatus: 'INVITED'
      })
    })
  })

  describe('POST /api/v1/invites/accept - Accept Invitation', () => {
    beforeAll(async () => {
      // Generate a real invite token for testing
      const member = await prisma.memberProfile.findUnique({
        where: { id: invitedMemberId },
        include: { user: true }
      })

      if (member) {
        inviteToken = await invitesService.createInviteToken({
          orgId: testOrgId,
          userId: member.userId,
          memberId: member.id
        })
      }
    })

    it('should successfully accept invitation and activate member', async () => {
      const acceptData = {
        token: inviteToken,
        password: 'SecurePassword123!'
      }

      const response = await request(app.getHttpServer())
        .post('/api/v1/invites/accept')
        .send(acceptData)
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        message: 'Welcome! Your account has been activated.',
        userId: expect.any(Number),
        memberId: invitedMemberId
      })

      // Verify member status changed to ACTIVE
      const activatedMember = await prisma.memberProfile.findUnique({
        where: { id: invitedMemberId },
        include: { user: true }
      })

      expect(activatedMember!.membershipStatus).toBe('ACTIVE')
      expect(activatedMember!.activatedAt).toBeTruthy()
      expect(activatedMember!.user.isEmailVerified).toBe(true)
      expect(activatedMember!.user.emailVerifiedAt).toBeTruthy()
      expect(activatedMember!.user.passwordHash).toBeTruthy()

      // Verify audit log for acceptance
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          orgId: testOrgId,
          action: 'INVITE_ACCEPTED',
          targetType: 'Member',
          targetId: invitedMemberId
        }
      })

      expect(auditLog).toBeTruthy()
    })

    it('should return error for invalid token', async () => {
      const acceptData = {
        token: 'invalid-token',
        password: 'SecurePassword123!'
      }

      await request(app.getHttpServer())
        .post('/api/v1/invites/accept')
        .send(acceptData)
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid or expired invite token')
        })
    })
  })

  describe('POST /api/v1/members/:id/inactivate', () => {
    it('should successfully inactivate an active member', async () => {
      const inactivateData = {
        reason: 'Member requested account deactivation for testing'
      }

      const response = await request(app.getHttpServer())
        .post(`/api/v1/members/${invitedMemberId}/inactivate`)
        .set('Authorization', adminToken)
        .send(inactivateData)
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        message: 'Member inactivated successfully',
        member: {
          id: invitedMemberId,
          membershipStatus: 'INACTIVE',
          inactivatedReason: 'Member requested account deactivation for testing'
        }
      })

      // Verify member status in database
      const inactivatedMember = await prisma.memberProfile.findUnique({
        where: { id: invitedMemberId }
      })

      expect(inactivatedMember!.membershipStatus).toBe('INACTIVE')
      expect(inactivatedMember!.inactivatedAt).toBeTruthy()
      expect(inactivatedMember!.inactivatedReason).toBe('Member requested account deactivation for testing')
    })
  })

  describe('POST /api/v1/members/:id/activate', () => {
    it('should successfully reactivate an inactive member', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/members/${invitedMemberId}/activate`)
        .set('Authorization', adminToken)
        .expect(200)

      expect(response.body).toMatchObject({
        success: true,
        message: 'Member activated successfully',
        member: {
          id: invitedMemberId,
          membershipStatus: 'ACTIVE'
        }
      })

      // Verify member status in database
      const reactivatedMember = await prisma.memberProfile.findUnique({
        where: { id: invitedMemberId }
      })

      expect(reactivatedMember!.membershipStatus).toBe('ACTIVE')
      expect(reactivatedMember!.activatedAt).toBeTruthy()
      expect(reactivatedMember!.inactivatedAt).toBeNull()
      expect(reactivatedMember!.inactivatedReason).toBeNull()
    })
  })
})