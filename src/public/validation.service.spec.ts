import { Test, TestingModule } from '@nestjs/testing'
import { ValidationService } from './validation.service'

describe('ValidationService', () => {
  let service: ValidationService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationService],
    }).compile()

    service = module.get<ValidationService>(ValidationService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('validatePhoneNumber', () => {
    it('should validate US phone number with parentheses', () => {
      const result = service.validatePhoneNumber('(555) 123-4567')
      
      expect(result.isValid).toBe(true)
      expect(result.formatted).toBe('+15551234567')
      expect(result.nationalFormat).toBe('(555) 123-4567')
      expect(result.internationalFormat).toBe('+1 555-123-4567')
      expect(result.type).toBeDefined()
    })

    it('should validate US phone number with dashes', () => {
      const result = service.validatePhoneNumber('555-123-4567')
      
      expect(result.isValid).toBe(true)
      expect(result.formatted).toBe('+15551234567')
    })

    it('should validate US phone number with spaces', () => {
      const result = service.validatePhoneNumber('555 123 4567')
      
      expect(result.isValid).toBe(true)
      expect(result.formatted).toBe('+15551234567')
    })

    it('should validate US phone number with +1 prefix', () => {
      const result = service.validatePhoneNumber('+1 555 123 4567')
      
      expect(result.isValid).toBe(true)
      expect(result.formatted).toBe('+15551234567')
    })

    it('should validate 10-digit number', () => {
      const result = service.validatePhoneNumber('5551234567')
      
      expect(result.isValid).toBe(true)
      expect(result.formatted).toBe('+15551234567')
    })

    it('should reject empty phone number', () => {
      const result = service.validatePhoneNumber('')
      
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('Phone number is required')
    })

    it('should reject invalid phone number', () => {
      const result = service.validatePhoneNumber('123')
      
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBeDefined()
    })

    it('should reject non-US phone number', () => {
      const result = service.validatePhoneNumber('+44 20 7946 0958') // UK number
      
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('Only US phone numbers are supported')
    })

    it('should handle malformed input gracefully', () => {
      const result = service.validatePhoneNumber('abc-def-ghij')
      
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBeDefined()
    })
  })

  describe('validateZipCode', () => {
    it('should validate 5-digit ZIP code', () => {
      const result = service.validateZipCode('12345')
      
      expect(result.isValid).toBe(true)
      expect(result.zipCode).toBe('12345')
      expect(result.zipCodeType).toBe('ZIP5')
    })

    it('should validate 9-digit ZIP code with dash', () => {
      const result = service.validateZipCode('12345-6789')
      
      expect(result.isValid).toBe(true)
      expect(result.zipCode).toBe('12345-6789')
      expect(result.zipCodeType).toBe('ZIP9')
    })

    it('should format 9-digit ZIP code without dash', () => {
      const result = service.validateZipCode('123456789')
      
      expect(result.isValid).toBe(true)
      expect(result.zipCode).toBe('12345-6789')
      expect(result.zipCodeType).toBe('ZIP9')
    })

    it('should clean and validate ZIP with spaces', () => {
      const result = service.validateZipCode(' 12345 ')
      
      expect(result.isValid).toBe(true)
      expect(result.zipCode).toBe('12345')
      expect(result.zipCodeType).toBe('ZIP5')
    })

    it('should reject empty ZIP code', () => {
      const result = service.validateZipCode('')
      
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('ZIP code is required')
    })

    it('should reject invalid ZIP code length', () => {
      const result = service.validateZipCode('123')
      
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('ZIP code must be 5 digits (12345) or 9 digits (12345-6789)')
    })

    it('should reject non-numeric ZIP code', () => {
      const result = service.validateZipCode('ABCDE')
      
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBe('ZIP code must be 5 digits (12345) or 9 digits (12345-6789)')
    })
  })

  describe('getZipCodeInfo', () => {
    it('should return state info for New York ZIP code', () => {
      const result = service.getZipCodeInfo('10001') // NYC
      
      expect(result.isValid).toBe(true)
      expect(result.zipCode).toBe('10001')
      expect(result.state).toBe('NY')
      expect(result.region).toBe('Northeast')
    })

    it('should return state info for California ZIP code', () => {
      const result = service.getZipCodeInfo('90210') // Beverly Hills
      
      expect(result.isValid).toBe(true)
      expect(result.zipCode).toBe('90210')
      expect(result.state).toBe('CA')
      expect(result.region).toBe('West')
    })

    it('should return state info for Texas ZIP code', () => {
      const result = service.getZipCodeInfo('75001') // Texas
      
      expect(result.isValid).toBe(true)
      expect(result.zipCode).toBe('75001')
      expect(result.state).toBe('TX')
      expect(result.region).toBe('South')
    })

    it('should return state info for Illinois ZIP code', () => {
      const result = service.getZipCodeInfo('60601') // Chicago
      
      expect(result.isValid).toBe(true)
      expect(result.zipCode).toBe('60601')
      expect(result.state).toBe('IL')
      expect(result.region).toBe('Midwest')
    })

    it('should handle ZIP+4 format', () => {
      const result = service.getZipCodeInfo('10001-1234')
      
      expect(result.isValid).toBe(true)
      expect(result.zipCode).toBe('10001-1234')
      expect(result.state).toBe('NY')
      expect(result.region).toBe('Northeast')
    })

    it('should return UNKNOWN for ZIP outside database range', () => {
      const result = service.getZipCodeInfo('99999') // Not in our range database
      
      expect(result.isValid).toBe(true)
      expect(result.zipCode).toBe('99999')
      expect(result.state).toBe('UNKNOWN')
      expect(result.region).toBe('UNKNOWN')
    })

    it('should reject invalid ZIP code format', () => {
      const result = service.getZipCodeInfo('invalid')
      
      expect(result.isValid).toBe(false)
      expect(result.errorMessage).toBeDefined()
    })
  })
})