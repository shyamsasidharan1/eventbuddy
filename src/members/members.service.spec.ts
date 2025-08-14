import { Test, TestingModule } from '@nestjs/testing'
import { MembersService } from './members.service'
import { PrismaService } from '../config/prisma.service'
import { InvitesService } from '../invites/invites.service'
import { EmailService } from '../email/email.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

describe('MembersService - Lifecycle Transitions', () => {
  let service: MembersService
  let prismaService: PrismaService
  let invitesService: InvitesService
  let emailService: EmailService

  const mockPrismaService = {
    memberProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn()
    },
    userAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    auditLog: {
      create: jest.fn()
    },
    $transaction: jest.fn()
  }

  const mockInvitesService = {
    createInviteToken: jest.fn()
  }

  const mockEmailService = {
    sendMemberInvite: jest.fn()
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService
        },
        {
          provide: InvitesService,
          useValue: mockInvitesService
        },
        {
          provide: EmailService,
          useValue: mockEmailService
        }
      ]
    }).compile()

    service = module.get<MembersService>(MembersService)
    prismaService = module.get<PrismaService>(PrismaService)
    invitesService = module.get<InvitesService>(InvitesService)
    emailService = module.get<EmailService>(EmailService)

    // Reset all mocks
    jest.clearAllMocks()
  })

  describe('invite', () => {
    const inviteParams = {
      orgId: 1,
      invitedByUserId: 2,
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe'
    }

    it('should successfully invite a new member', async () => {
      // Mock no existing user
      mockPrismaService.userAccount.findUnique.mockResolvedValue(null)
      
      // Mock transaction
      const mockUser = { id: 10, email: 'test@example.com' }
      const mockMember = { 
        id: 20, 
        membershipStatus: 'INVITED',
        invitedAt: new Date(),
        firstName: 'John',
        lastName: 'Doe'
      }
      
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          userAccount: {
            create: jest.fn().mockResolvedValue(mockUser)
          },
          memberProfile: {
            create: jest.fn().mockResolvedValue(mockMember)
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({})
          }
        })
      })

      mockInvitesService.createInviteToken.mockResolvedValue('mock-token')
      mockEmailService.sendMemberInvite.mockResolvedValue(undefined)

      const result = await service.invite(inviteParams)

      expect(result).toEqual({
        success: true,
        message: 'Member invitation sent successfully',
        member: {
          id: 20,
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          membershipStatus: 'INVITED',
          invitedAt: mockMember.invitedAt
        }
      })

      expect(mockInvitesService.createInviteToken).toHaveBeenCalledWith({
        orgId: 1,
        userId: 10,
        memberId: 20
      })

      expect(mockEmailService.sendMemberInvite).toHaveBeenCalledWith({
        to: 'test@example.com',
        firstName: 'John',
        token: 'mock-token',
        orgId: 1
      })
    })

    it('should throw error if member is already active', async () => {
      const existingUser = {
        memberProfile: {
          membershipStatus: 'ACTIVE'
        }
      }
      
      mockPrismaService.userAccount.findUnique.mockResolvedValue(existingUser)

      await expect(service.invite(inviteParams)).rejects.toThrow(
        new BadRequestException('Member already exists and is active')
      )
    })

    it('should throw error if member is already invited', async () => {
      const existingUser = {
        memberProfile: {
          membershipStatus: 'INVITED'
        }
      }
      
      mockPrismaService.userAccount.findUnique.mockResolvedValue(existingUser)

      await expect(service.invite(inviteParams)).rejects.toThrow(
        new BadRequestException('Member has already been invited')
      )
    })
  })

  describe('inactivate', () => {
    const inactivateParams = {
      id: 1,
      orgId: 1,
      reason: 'Member requested deactivation',
      actorId: 2
    }

    it('should successfully inactivate an active member', async () => {
      const mockMember = {
        id: 1,
        userId: 10,
        membershipStatus: 'ACTIVE',
        user: { id: 10 }
      }

      mockPrismaService.memberProfile.findUnique.mockResolvedValue(mockMember)

      const updatedMember = {
        id: 1,
        membershipStatus: 'INACTIVE',
        inactivatedAt: new Date(),
        inactivatedReason: 'Member requested deactivation'
      }

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          memberProfile: {
            update: jest.fn().mockResolvedValue(updatedMember)
          },
          userAccount: {
            update: jest.fn().mockResolvedValue({})
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({})
          }
        })
      })

      const result = await service.inactivate(inactivateParams)

      expect(result).toEqual({
        success: true,
        message: 'Member inactivated successfully',
        member: {
          id: 1,
          membershipStatus: 'INACTIVE',
          inactivatedAt: updatedMember.inactivatedAt,
          inactivatedReason: 'Member requested deactivation'
        }
      })
    })

    it('should throw error if member not found', async () => {
      mockPrismaService.memberProfile.findUnique.mockResolvedValue(null)

      await expect(service.inactivate(inactivateParams)).rejects.toThrow(
        new NotFoundException('Member not found')
      )
    })

    it('should throw error if member is already inactive', async () => {
      const mockMember = {
        id: 1,
        membershipStatus: 'INACTIVE'
      }

      mockPrismaService.memberProfile.findUnique.mockResolvedValue(mockMember)

      await expect(service.inactivate(inactivateParams)).rejects.toThrow(
        new BadRequestException('Member is already inactive')
      )
    })
  })

  describe('activate', () => {
    const activateParams = {
      id: 1,
      orgId: 1,
      actorId: 2
    }

    it('should successfully activate an inactive member', async () => {
      const mockMember = {
        id: 1,
        userId: 10,
        membershipStatus: 'INACTIVE',
        user: { id: 10 }
      }

      mockPrismaService.memberProfile.findUnique.mockResolvedValue(mockMember)

      const updatedMember = {
        id: 1,
        membershipStatus: 'ACTIVE',
        activatedAt: new Date()
      }

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          memberProfile: {
            update: jest.fn().mockResolvedValue(updatedMember)
          },
          userAccount: {
            update: jest.fn().mockResolvedValue({})
          },
          auditLog: {
            create: jest.fn().mockResolvedValue({})
          }
        })
      })

      const result = await service.activate(activateParams)

      expect(result).toEqual({
        success: true,
        message: 'Member activated successfully',
        member: {
          id: 1,
          membershipStatus: 'ACTIVE',
          activatedAt: updatedMember.activatedAt
        }
      })
    })

    it('should throw error if member not found', async () => {
      mockPrismaService.memberProfile.findUnique.mockResolvedValue(null)

      await expect(service.activate(activateParams)).rejects.toThrow(
        new NotFoundException('Member not found')
      )
    })

    it('should throw error if member is already active', async () => {
      const mockMember = {
        id: 1,
        membershipStatus: 'ACTIVE'
      }

      mockPrismaService.memberProfile.findUnique.mockResolvedValue(mockMember)

      await expect(service.activate(activateParams)).rejects.toThrow(
        new BadRequestException('Member is already active')
      )
    })
  })
})