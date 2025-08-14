import { Test, TestingModule } from '@nestjs/testing'
import { PublicController } from './public.controller'
import { PublicService } from './public.service'
import { ValidationService } from './validation.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

describe('PublicController', () => {
  let controller: PublicController
  let service: PublicService
  let validationService: ValidationService

  const mockPublicService = {
    submitRegistrationRequest: jest.fn(),
    getOrganizationInfo: jest.fn()
  }

  const mockValidationService = {
    validatePhoneNumber: jest.fn(),
    getZipCodeInfo: jest.fn()
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicController],
      providers: [
        {
          provide: PublicService,
          useValue: mockPublicService
        },
        {
          provide: ValidationService,
          useValue: mockValidationService
        }
      ]
    }).compile()

    controller = module.get<PublicController>(PublicController)
    service = module.get<PublicService>(PublicService)
    validationService = module.get<ValidationService>(ValidationService)

    // Reset mocks
    Object.values(mockPublicService).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockReset()
      }
    })
    Object.values(mockValidationService).forEach(mock => {
      if (jest.isMockFunction(mock)) {
        mock.mockReset()
      }
    })
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('submitRegistrationRequest', () => {
    const validDto = {
      orgId: 1,
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '(555) 123-4567',
      zipCode: '12345',
      requestMessage: 'I want to join'
    }

    it('should successfully submit registration request', async () => {
      const expectedResult = {
        success: true,
        message: 'Registration request submitted successfully',
        requestId: 123,
        organizationName: 'Test Charity',
        status: 'PENDING_APPROVAL'
      }

      mockPublicService.submitRegistrationRequest.mockResolvedValue(expectedResult)

      const result = await controller.submitRegistrationRequest(validDto)

      expect(result).toEqual(expectedResult)
      expect(service.submitRegistrationRequest).toHaveBeenCalledWith(validDto)
    })

    it('should handle BadRequestException from service', async () => {
      mockPublicService.submitRegistrationRequest.mockRejectedValue(
        new BadRequestException('Invalid request data')
      )

      await expect(controller.submitRegistrationRequest(validDto))
        .rejects.toThrow(BadRequestException)
    })

    it('should handle NotFoundException from service', async () => {
      mockPublicService.submitRegistrationRequest.mockRejectedValue(
        new NotFoundException('Organization not found')
      )

      await expect(controller.submitRegistrationRequest(validDto))
        .rejects.toThrow(NotFoundException)
    })
  })

  describe('getOrganizationInfo', () => {
    const mockOrgInfo = {
      id: 1,
      name: 'Test Charity',
      webUrl: 'test-charity.org'
    }

    it('should return organization info by ID', async () => {
      mockPublicService.getOrganizationInfo.mockResolvedValue(mockOrgInfo)

      const result = await controller.getOrganizationInfo('1')

      expect(result).toEqual(mockOrgInfo)
      expect(service.getOrganizationInfo).toHaveBeenCalledWith('1')
    })

    it('should return organization info by webUrl', async () => {
      mockPublicService.getOrganizationInfo.mockResolvedValue(mockOrgInfo)

      const result = await controller.getOrganizationInfo('test-charity.org')

      expect(result).toEqual(mockOrgInfo)
      expect(service.getOrganizationInfo).toHaveBeenCalledWith('test-charity.org')
    })

    it('should handle NotFoundException from service', async () => {
      mockPublicService.getOrganizationInfo.mockRejectedValue(
        new NotFoundException('Organization not found')
      )

      await expect(controller.getOrganizationInfo('nonexistent'))
        .rejects.toThrow(NotFoundException)
    })
  })

  describe('validatePhone', () => {
    const validPhoneDto = { phone: '(555) 123-4567' }

    it('should validate phone number successfully', async () => {
      const expectedResult = {
        isValid: true,
        formatted: '+15551234567',
        nationalFormat: '(555) 123-4567',
        internationalFormat: '+1 555-123-4567',
        type: 'MOBILE'
      }

      mockValidationService.validatePhoneNumber.mockReturnValue(expectedResult)

      const result = await controller.validatePhone(validPhoneDto)

      expect(result).toEqual(expectedResult)
      expect(validationService.validatePhoneNumber).toHaveBeenCalledWith('(555) 123-4567')
    })

    it('should return validation error for invalid phone', async () => {
      const invalidResult = {
        isValid: false,
        errorMessage: 'Invalid phone number format'
      }

      mockValidationService.validatePhoneNumber.mockReturnValue(invalidResult)

      const result = await controller.validatePhone({ phone: 'invalid' })

      expect(result).toEqual(invalidResult)
    })
  })

  describe('validateZipCode', () => {
    const validZipDto = { zipCode: '12345' }

    it('should validate ZIP code successfully', async () => {
      const expectedResult = {
        isValid: true,
        zipCode: '12345',
        zipCodeType: 'ZIP5',
        state: 'NY',
        region: 'Northeast'
      }

      mockValidationService.getZipCodeInfo.mockReturnValue(expectedResult)

      const result = await controller.validateZipCode(validZipDto)

      expect(result).toEqual(expectedResult)
      expect(validationService.getZipCodeInfo).toHaveBeenCalledWith('12345')
    })

    it('should return validation error for invalid ZIP', async () => {
      const invalidResult = {
        isValid: false,
        errorMessage: 'ZIP code must be 5 digits (12345) or 9 digits (12345-6789)'
      }

      mockValidationService.getZipCodeInfo.mockReturnValue(invalidResult)

      const result = await controller.validateZipCode({ zipCode: 'invalid' })

      expect(result).toEqual(invalidResult)
    })
  })

  describe('validatePhoneGet', () => {
    it('should validate phone number via GET request', async () => {
      const expectedResult = {
        isValid: true,
        formatted: '+15551234567',
        nationalFormat: '(555) 123-4567',
        internationalFormat: '+1 555-123-4567',
        type: 'MOBILE'
      }

      mockValidationService.validatePhoneNumber.mockReturnValue(expectedResult)

      const result = await controller.validatePhoneGet('%28555%29%20123-4567')

      expect(result).toEqual(expectedResult)
      expect(validationService.validatePhoneNumber).toHaveBeenCalledWith('(555) 123-4567')
    })
  })

  describe('validateZipCodeGet', () => {
    it('should validate ZIP code via GET request', async () => {
      const expectedResult = {
        isValid: true,
        zipCode: '12345',
        zipCodeType: 'ZIP5',
        state: 'NY',
        region: 'Northeast'
      }

      mockValidationService.getZipCodeInfo.mockReturnValue(expectedResult)

      const result = await controller.validateZipCodeGet('12345')

      expect(result).toEqual(expectedResult)
      expect(validationService.getZipCodeInfo).toHaveBeenCalledWith('12345')
    })
  })
})