import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsNotEmpty } from 'class-validator'

export class ValidatePhoneDto {
  @ApiProperty({
    description: 'Phone number to validate',
    example: '(555) 123-4567',
  })
  @IsString()
  @IsNotEmpty()
  phone: string
}

export class PhoneValidationResponseDto {
  @ApiProperty({
    description: 'Whether the phone number is valid',
    example: true
  })
  isValid: boolean

  @ApiProperty({
    description: 'Formatted phone number in E164 format',
    example: '+15551234567',
    required: false
  })
  formatted?: string

  @ApiProperty({
    description: 'Phone number in national format',
    example: '(555) 123-4567',
    required: false
  })
  nationalFormat?: string

  @ApiProperty({
    description: 'Phone number in international format',
    example: '+1 555-123-4567',
    required: false
  })
  internationalFormat?: string

  @ApiProperty({
    description: 'Type of phone number',
    example: 'MOBILE',
    enum: ['FIXED_LINE', 'MOBILE', 'FIXED_LINE_OR_MOBILE', 'TOLL_FREE', 'PREMIUM_RATE', 'SHARED_COST', 'VOIP', 'PERSONAL_NUMBER', 'PAGER', 'UAN', 'VOICEMAIL', 'UNKNOWN'],
    required: false
  })
  type?: string

  @ApiProperty({
    description: 'Error message if validation failed',
    example: 'Invalid phone number format',
    required: false
  })
  errorMessage?: string
}