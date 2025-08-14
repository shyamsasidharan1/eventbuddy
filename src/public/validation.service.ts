import { Injectable, HttpException, HttpStatus } from '@nestjs/common'
import { PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber'

@Injectable()
export class ValidationService {
  private phoneUtil = PhoneNumberUtil.getInstance()

  /**
   * Validate and format US phone number
   */
  validatePhoneNumber(phone: string): { 
    isValid: boolean
    formatted?: string
    nationalFormat?: string
    internationalFormat?: string
    type?: string
    errorMessage?: string
  } {
    try {
      if (!phone || phone.trim() === '') {
        return {
          isValid: false,
          errorMessage: 'Phone number is required'
        }
      }

      // Parse the phone number for US region
      const number = this.phoneUtil.parse(phone, 'US')
      
      // Check if the number is valid
      const isValid = this.phoneUtil.isValidNumber(number)
      
      if (!isValid) {
        return {
          isValid: false,
          errorMessage: 'Invalid phone number format'
        }
      }

      // Check if it's a US number
      const region = this.phoneUtil.getRegionCodeForNumber(number)
      if (region !== 'US') {
        return {
          isValid: false,
          errorMessage: 'Only US phone numbers are supported'
        }
      }

      // Get number type
      const numberType = this.phoneUtil.getNumberType(number)
      let type = 'UNKNOWN'
      
      switch (numberType) {
        case 0: type = 'FIXED_LINE'; break
        case 1: type = 'MOBILE'; break
        case 2: type = 'FIXED_LINE_OR_MOBILE'; break
        case 3: type = 'TOLL_FREE'; break
        case 4: type = 'PREMIUM_RATE'; break
        case 5: type = 'SHARED_COST'; break
        case 6: type = 'VOIP'; break
        case 7: type = 'PERSONAL_NUMBER'; break
        case 8: type = 'PAGER'; break
        case 9: type = 'UAN'; break
        case 10: type = 'VOICEMAIL'; break
      }

      return {
        isValid: true,
        formatted: this.phoneUtil.format(number, PhoneNumberFormat.E164),
        nationalFormat: this.phoneUtil.format(number, PhoneNumberFormat.NATIONAL),
        internationalFormat: this.phoneUtil.format(number, PhoneNumberFormat.INTERNATIONAL),
        type
      }
    } catch (error) {
      return {
        isValid: false,
        errorMessage: 'Unable to parse phone number'
      }
    }
  }

  /**
   * Validate US ZIP code and get basic info
   */
  validateZipCode(zipCode: string): {
    isValid: boolean
    zipCode?: string
    zipCodeType?: string
    errorMessage?: string
  } {
    try {
      if (!zipCode || zipCode.trim() === '') {
        return {
          isValid: false,
          errorMessage: 'ZIP code is required'
        }
      }

      const cleanZip = zipCode.trim()

      // Check for 5-digit ZIP
      const fiveDigitPattern = /^\d{5}$/
      // Check for 9-digit ZIP (ZIP+4)
      const nineDigitPattern = /^\d{5}-\d{4}$/

      if (fiveDigitPattern.test(cleanZip)) {
        return {
          isValid: true,
          zipCode: cleanZip,
          zipCodeType: 'ZIP5'
        }
      }

      if (nineDigitPattern.test(cleanZip)) {
        return {
          isValid: true,
          zipCode: cleanZip,
          zipCodeType: 'ZIP9'
        }
      }

      // Try to fix common formats
      const digitsOnly = cleanZip.replace(/\D/g, '')
      
      if (digitsOnly.length === 5) {
        return {
          isValid: true,
          zipCode: digitsOnly,
          zipCodeType: 'ZIP5'
        }
      }

      if (digitsOnly.length === 9) {
        const formatted = `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5)}`
        return {
          isValid: true,
          zipCode: formatted,
          zipCodeType: 'ZIP9'
        }
      }

      return {
        isValid: false,
        errorMessage: 'ZIP code must be 5 digits (12345) or 9 digits (12345-6789)'
      }
    } catch (error) {
      return {
        isValid: false,
        errorMessage: 'Unable to validate ZIP code'
      }
    }
  }

  /**
   * Get ZIP code location info (basic validation without external API)
   */
  getZipCodeInfo(zipCode: string): {
    isValid: boolean
    zipCode?: string
    state?: string
    region?: string
    errorMessage?: string
  } {
    const validation = this.validateZipCode(zipCode)
    
    if (!validation.isValid) {
      return {
        isValid: false,
        errorMessage: validation.errorMessage
      }
    }

    const zip5 = validation.zipCode!.slice(0, 5)
    const zipNum = parseInt(zip5)

    // Basic US ZIP code ranges by state (partial list for demonstration)
    const zipRanges = [
      { min: 1000, max: 2799, state: 'MA', region: 'Northeast' },
      { min: 2800, max: 2999, state: 'RI', region: 'Northeast' },
      { min: 3000, max: 3899, state: 'NH', region: 'Northeast' },
      { min: 4000, max: 4999, state: 'ME', region: 'Northeast' },
      { min: 5000, max: 5999, state: 'VT', region: 'Northeast' },
      { min: 6000, max: 6999, state: 'CT', region: 'Northeast' },
      { min: 7000, max: 8999, state: 'NJ', region: 'Northeast' },
      { min: 10000, max: 14999, state: 'NY', region: 'Northeast' },
      { min: 15000, max: 19699, state: 'PA', region: 'Northeast' },
      { min: 20000, max: 20599, state: 'DC', region: 'South' },
      { min: 20600, max: 21999, state: 'MD', region: 'South' },
      { min: 22000, max: 24699, state: 'VA', region: 'South' },
      { min: 25000, max: 26999, state: 'WV', region: 'South' },
      { min: 27000, max: 28999, state: 'NC', region: 'South' },
      { min: 29000, max: 29999, state: 'SC', region: 'South' },
      { min: 30000, max: 39999, state: 'GA', region: 'South' },
      { min: 32000, max: 34999, state: 'FL', region: 'South' },
      { min: 35000, max: 36999, state: 'AL', region: 'South' },
      { min: 37000, max: 38599, state: 'TN', region: 'South' },
      { min: 38600, max: 39999, state: 'MS', region: 'South' },
      { min: 40000, max: 42799, state: 'KY', region: 'South' },
      { min: 43000, max: 45999, state: 'OH', region: 'Midwest' },
      { min: 46000, max: 47999, state: 'IN', region: 'Midwest' },
      { min: 48000, max: 49999, state: 'MI', region: 'Midwest' },
      { min: 50000, max: 52999, state: 'IA', region: 'Midwest' },
      { min: 53000, max: 54999, state: 'WI', region: 'Midwest' },
      { min: 55000, max: 56799, state: 'MN', region: 'Midwest' },
      { min: 57000, max: 57799, state: 'SD', region: 'Midwest' },
      { min: 58000, max: 58899, state: 'ND', region: 'Midwest' },
      { min: 59000, max: 59999, state: 'MT', region: 'West' },
      { min: 60000, max: 62999, state: 'IL', region: 'Midwest' },
      { min: 63000, max: 65999, state: 'MO', region: 'Midwest' },
      { min: 66000, max: 67999, state: 'KS', region: 'Midwest' },
      { min: 68000, max: 69999, state: 'NE', region: 'Midwest' },
      { min: 70000, max: 71599, state: 'LA', region: 'South' },
      { min: 71600, max: 72999, state: 'AR', region: 'South' },
      { min: 73000, max: 74999, state: 'OK', region: 'South' },
      { min: 75000, max: 79999, state: 'TX', region: 'South' },
      { min: 80000, max: 81999, state: 'CO', region: 'West' },
      { min: 82000, max: 83199, state: 'WY', region: 'West' },
      { min: 83200, max: 83899, state: 'ID', region: 'West' },
      { min: 84000, max: 84999, state: 'UT', region: 'West' },
      { min: 85000, max: 86599, state: 'AZ', region: 'West' },
      { min: 87000, max: 88499, state: 'NM', region: 'West' },
      { min: 88900, max: 89999, state: 'NV', region: 'West' },
      { min: 90000, max: 96199, state: 'CA', region: 'West' },
      { min: 97000, max: 97999, state: 'OR', region: 'West' },
      { min: 98000, max: 99499, state: 'WA', region: 'West' }
    ]

    for (const range of zipRanges) {
      if (zipNum >= range.min && zipNum <= range.max) {
        return {
          isValid: true,
          zipCode: validation.zipCode,
          state: range.state,
          region: range.region
        }
      }
    }

    // ZIP code is valid format but not in our range database
    return {
      isValid: true,
      zipCode: validation.zipCode,
      state: 'UNKNOWN',
      region: 'UNKNOWN'
    }
  }
}