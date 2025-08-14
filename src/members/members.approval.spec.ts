import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { MembersService } from './members.service'
import { PrismaService } from '../config/prisma.service'
import { InvitesService } from '../invites/invites.service'
import { EmailService } from '../email/email.service'

describe('MembersService - Approval Workflow', () => {
  let service: MembersService
  let prismaService: PrismaService
  let emailService: EmailService

  const mockPrismaService = {
    memberProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    userAccount: {
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  }

  const mockInvitesService = {}

  const mockEmailService = {
    sendRegistrationApproval: jest.fn(),
    sendRegistrationDenial: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: InvitesService,
          useValue: mockInvitesService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile()

    service = module.get<MembersService>(MembersService)
    prismaService = module.get<PrismaService>(PrismaService)
    emailService = module.get<EmailService>(EmailService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('approveRegistration', () => {
    const mockMember = {
      id: 1,
      firstName: 'John',
      lastName: 'Doe',
      membershipStatus: 'PENDING_APPROVAL',
      user: {
        id: 10,
        email: 'john.doe@example.com',
      },
      organization: {
        id: 1,
        name: 'Test Organization',
      },
    }

    const approveParams = {
      memberId: 1,
      orgId: 1,
      approve: true,
      message: 'Welcome to our organization!',
      actorId: 5,
    }

    it('should successfully approve a pending registration', async () => {
      const updatedMember = {
        ...mockMember,
        membershipStatus: 'ACTIVE',
        approvedAt: new Date(),
        activatedAt: new Date(),
      }

      mockPrismaService.memberProfile.findUnique.mockResolvedValue(mockMember)
      
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          memberProfile: { update: jest.fn().mockResolvedValue(updatedMember) },
          userAccount: { update: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        })
      })

      mockEmailService.sendRegistrationApproval.mockResolvedValue(undefined)

      const result = await service.approveRegistration(approveParams)

      expect(result).toEqual({
        success: true,
        message: 'Member approved successfully',
        member: {
          id: updatedMember.id,
          firstName: updatedMember.firstName,
          lastName: updatedMember.lastName,
          membershipStatus: updatedMember.membershipStatus,
          approvedAt: updatedMember.approvedAt,
          deniedAt: updatedMember.deniedAt,
          denialReason: updatedMember.denialReason,
        },
      })

      expect(mockEmailService.sendRegistrationApproval).toHaveBeenCalledWith({
        to: mockMember.user.email,
        firstName: mockMember.firstName,
        organizationName: mockMember.organization.name,
        message: approveParams.message,
      })
    })

    it('should successfully deny a pending registration', async () => {
      const denyParams = {
        ...approveParams,
        approve: false,
        denialReason: 'Application does not meet criteria',
        message: 'Thank you for your interest',
      }

      const updatedMember = {
        ...mockMember,
        membershipStatus: 'INACTIVE',
        deniedAt: new Date(),
        denialReason: denyParams.denialReason,
      }

      mockPrismaService.memberProfile.findUnique.mockResolvedValue(mockMember)
      
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          memberProfile: { update: jest.fn().mockResolvedValue(updatedMember) },
          userAccount: { update: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        })
      })

      mockEmailService.sendRegistrationDenial.mockResolvedValue(undefined)

      const result = await service.approveRegistration(denyParams)

      expect(result).toEqual({
        success: true,
        message: 'Member registration denied',
        member: {
          id: updatedMember.id,
          firstName: updatedMember.firstName,
          lastName: updatedMember.lastName,
          membershipStatus: updatedMember.membershipStatus,
          approvedAt: updatedMember.approvedAt,
          deniedAt: updatedMember.deniedAt,
          denialReason: updatedMember.denialReason,
        },
      })

      expect(mockEmailService.sendRegistrationDenial).toHaveBeenCalledWith({
        to: mockMember.user.email,
        firstName: mockMember.firstName,
        organizationName: mockMember.organization.name,
        denialReason: denyParams.denialReason,
        message: denyParams.message,
      })
    })

    it('should throw NotFoundException when member not found', async () => {
      mockPrismaService.memberProfile.findUnique.mockResolvedValue(null)

      await expect(service.approveRegistration(approveParams)).rejects.toThrow(
        new NotFoundException('Member not found')
      )
    })

    it('should throw BadRequestException when member not pending approval', async () => {
      const activeMember = { ...mockMember, membershipStatus: 'ACTIVE' }
      mockPrismaService.memberProfile.findUnique.mockResolvedValue(activeMember)

      await expect(service.approveRegistration(approveParams)).rejects.toThrow(
        new BadRequestException('Member is not pending approval')
      )
    })

    it('should throw BadRequestException when denying without reason', async () => {
      const denyParams = {
        ...approveParams,
        approve: false,
        denialReason: undefined,
      }

      mockPrismaService.memberProfile.findUnique.mockResolvedValue(mockMember)

      await expect(service.approveRegistration(denyParams)).rejects.toThrow(
        new BadRequestException('Denial reason is required when denying membership')
      )
    })
  })

  describe('getPendingApprovals', () => {
    const mockPendingMembers = [
      {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        membershipStatus: 'PENDING_APPROVAL',
        registrationRequestedAt: new Date(),
        registrationMessage: 'I want to join',
        user: {
          id: 10,
          email: 'john.doe@example.com',
          createdAt: new Date(),
        },
      },
      {
        id: 2,
        firstName: 'Jane',
        lastName: 'Smith',
        membershipStatus: 'PENDING_APPROVAL',
        registrationRequestedAt: new Date(),
        registrationMessage: 'Please consider my application',
        user: {
          id: 11,
          email: 'jane.smith@example.com',
          createdAt: new Date(),
        },
      },
    ]

    it('should return pending approvals with pagination', async () => {
      mockPrismaService.memberProfile.findMany.mockResolvedValue(mockPendingMembers)
      mockPrismaService.memberProfile.count.mockResolvedValue(2)

      const result = await service.getPendingApprovals({
        orgId: 1,
        page: 1,
        pageSize: 20,
      })

      expect(result).toEqual({
        data: mockPendingMembers,
        pagination: {
          page: 1,
          pageSize: 20,
          total: 2,
          totalPages: 1,
        },
      })

      expect(mockPrismaService.memberProfile.findMany).toHaveBeenCalledWith({
        where: {
          orgId: 1,
          membershipStatus: 'PENDING_APPROVAL',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              createdAt: true,
            },
          },
        },
        orderBy: [
          { registrationRequestedAt: 'desc' },
        ],
        skip: 0,
        take: 20,
      })
    })

    it('should handle pagination correctly', async () => {
      mockPrismaService.memberProfile.findMany.mockResolvedValue([mockPendingMembers[0]])
      mockPrismaService.memberProfile.count.mockResolvedValue(5)

      const result = await service.getPendingApprovals({
        orgId: 1,
        page: 2,
        pageSize: 2,
      })

      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 2,
        total: 5,
        totalPages: 3,
      })

      expect(mockPrismaService.memberProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 2, // (page - 1) * pageSize = (2 - 1) * 2 = 2
          take: 2,
        })
      )
    })

    it('should return empty results when no pending approvals', async () => {
      mockPrismaService.memberProfile.findMany.mockResolvedValue([])
      mockPrismaService.memberProfile.count.mockResolvedValue(0)

      const result = await service.getPendingApprovals({
        orgId: 1,
      })

      expect(result).toEqual({
        data: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        },
      })
    })
  })
})