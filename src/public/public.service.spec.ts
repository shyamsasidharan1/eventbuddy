import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { PublicService } from './public.service'
import { PrismaService } from '../config/prisma.service'
import { EmailService } from '../email/email.service'
import { RegisterRequestDto } from './dto/register-request.dto'

describe('PublicService', () => {
  let service: PublicService
  let prismaService: PrismaService
  let emailService: EmailService

  const mockPrismaService = {
    organization: {
      findUnique: jest.fn(),
    },
    userAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    memberProfile: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  }

  const mockEmailService = {
    sendRegistrationRequestConfirmation: jest.fn(),
    sendNewRegistrationNotification: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile()

    service = module.get<PublicService>(PublicService)
    prismaService = module.get<PrismaService>(PrismaService)
    emailService = module.get<EmailService>(EmailService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('submitRegistrationRequest', () => {
    const mockOrganization = {
      id: 1,
      name: 'Test Organization',
      webUrl: 'test-org.com',
      isActive: true,
    }

    const mockRegisterDto: RegisterRequestDto = {
      orgId: 1,
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '(555) 123-4567',
      zipCode: '12345',
      requestMessage: 'I would like to join your organization',
    }

    it('should successfully submit registration request with orgId', async () => {
      const mockUser = { id: 1 }
      const mockMember = { id: 1, firstName: 'John', lastName: 'Doe' }

      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrganization)
      mockPrismaService.userAccount.findUnique.mockResolvedValue(null)
      
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          userAccount: { create: jest.fn().mockResolvedValue(mockUser) },
          memberProfile: { create: jest.fn().mockResolvedValue(mockMember) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        })
      })

      mockEmailService.sendRegistrationRequestConfirmation.mockResolvedValue(undefined)
      // Mock the private method call
      service['notifyAdminsOfNewRequest'] = jest.fn().mockResolvedValue(undefined)

      const result = await service.submitRegistrationRequest(mockRegisterDto)

      expect(result).toEqual({
        success: true,
        message: 'Registration request submitted successfully',
        requestId: mockMember.id,
        organizationName: mockOrganization.name,
        status: 'PENDING_APPROVAL',
      })

      expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 1, isActive: true },
      })
      expect(mockEmailService.sendRegistrationRequestConfirmation).toHaveBeenCalledWith({
        to: mockRegisterDto.email,
        firstName: mockRegisterDto.firstName,
        organizationName: mockOrganization.name,
        requestId: mockMember.id,
      })
    })

    it('should successfully submit registration request with orgWebUrl', async () => {
      const dtoWithWebUrl = { ...mockRegisterDto, orgId: undefined, orgWebUrl: 'test-org.com' }
      const mockUser = { id: 1 }
      const mockMember = { id: 1, firstName: 'John', lastName: 'Doe' }

      mockPrismaService.organization.findUnique
        .mockResolvedValueOnce(null) // First call with orgId fails
        .mockResolvedValueOnce(mockOrganization) // Second call with webUrl succeeds
      
      mockPrismaService.userAccount.findUnique.mockResolvedValue(null)
      
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          userAccount: { create: jest.fn().mockResolvedValue(mockUser) },
          memberProfile: { create: jest.fn().mockResolvedValue(mockMember) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        })
      })

      service['notifyAdminsOfNewRequest'] = jest.fn().mockResolvedValue(undefined)

      const result = await service.submitRegistrationRequest(dtoWithWebUrl)

      expect(result.success).toBe(true)
      expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({
        where: { webUrl: 'test-org.com', isActive: true },
      })
    })

    it('should throw BadRequestException when neither orgId nor orgWebUrl provided', async () => {
      const invalidDto = { ...mockRegisterDto, orgId: undefined, orgWebUrl: undefined }

      await expect(service.submitRegistrationRequest(invalidDto)).rejects.toThrow(
        new BadRequestException('Either orgId or orgWebUrl must be provided')
      )
    })

    it('should throw NotFoundException when organization not found', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null)

      await expect(service.submitRegistrationRequest(mockRegisterDto)).rejects.toThrow(
        new NotFoundException('Organization not found or inactive')
      )
    })

    it('should throw BadRequestException when user already active member', async () => {
      const existingUser = {
        id: 1,
        email: 'test@example.com',
        memberProfile: {
          id: 1,
          membershipStatus: 'ACTIVE',
        },
      }

      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrganization)
      mockPrismaService.userAccount.findUnique.mockResolvedValue(existingUser)

      await expect(service.submitRegistrationRequest(mockRegisterDto)).rejects.toThrow(
        new BadRequestException('You are already an active member of this organization')
      )
    })

    it('should throw BadRequestException when registration already pending', async () => {
      const existingUser = {
        id: 1,
        email: 'test@example.com',
        memberProfile: {
          id: 1,
          membershipStatus: 'PENDING_APPROVAL',
        },
      }

      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrganization)
      mockPrismaService.userAccount.findUnique.mockResolvedValue(existingUser)

      await expect(service.submitRegistrationRequest(mockRegisterDto)).rejects.toThrow(
        new BadRequestException('You have already submitted a registration request for this organization')
      )
    })

    it('should throw BadRequestException when user already invited', async () => {
      const existingUser = {
        id: 1,
        email: 'test@example.com',
        memberProfile: {
          id: 1,
          membershipStatus: 'INVITED',
        },
      }

      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrganization)
      mockPrismaService.userAccount.findUnique.mockResolvedValue(existingUser)

      await expect(service.submitRegistrationRequest(mockRegisterDto)).rejects.toThrow(
        new BadRequestException('You have already been invited to this organization. Please check your email.')
      )
    })

    it('should throw BadRequestException when user previously inactive', async () => {
      const existingUser = {
        id: 1,
        email: 'test@example.com',
        memberProfile: {
          id: 1,
          membershipStatus: 'INACTIVE',
        },
      }

      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrganization)
      mockPrismaService.userAccount.findUnique.mockResolvedValue(existingUser)

      await expect(service.submitRegistrationRequest(mockRegisterDto)).rejects.toThrow(
        new BadRequestException('Your membership was previously deactivated. Please contact an administrator.')
      )
    })
  })

  describe('getOrganizationInfo', () => {
    const mockOrganization = {
      id: 1,
      name: 'Test Organization',
      webUrl: 'test-org.com',
    }

    it('should get organization by numeric ID', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrganization)

      const result = await service.getOrganizationInfo('1')

      expect(result).toEqual(mockOrganization)
      expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({
        where: { id: 1, isActive: true },
        select: {
          id: true,
          name: true,
          webUrl: true,
        },
      })
    })

    it('should get organization by webUrl when numeric lookup fails', async () => {
      mockPrismaService.organization.findUnique
        .mockResolvedValueOnce(null) // First call with ID fails
        .mockResolvedValueOnce(mockOrganization) // Second call with webUrl succeeds

      const result = await service.getOrganizationInfo('test-org.com')

      expect(result).toEqual(mockOrganization)
      expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({
        where: { webUrl: 'test-org.com', isActive: true },
        select: {
          id: true,
          name: true,
          webUrl: true,
        },
      })
    })

    it('should get organization by webUrl for non-numeric identifier', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrganization)

      const result = await service.getOrganizationInfo('test-org.com')

      expect(result).toEqual(mockOrganization)
      // Should skip the numeric check and go straight to webUrl lookup
      expect(mockPrismaService.organization.findUnique).toHaveBeenCalledWith({
        where: { webUrl: 'test-org.com', isActive: true },
        select: {
          id: true,
          name: true,
          webUrl: true,
        },
      })
    })

    it('should throw NotFoundException when organization not found', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null)

      await expect(service.getOrganizationInfo('nonexistent')).rejects.toThrow(
        new NotFoundException('Organization not found')
      )
    })
  })
})