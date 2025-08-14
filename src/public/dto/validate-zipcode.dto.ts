import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsNotEmpty } from 'class-validator'

export class ValidateZipCodeDto {
  @ApiProperty({
    description: 'ZIP code to validate',
    example: '12345',
  })
  @IsString()
  @IsNotEmpty()
  zipCode: string
}

export class ZipCodeValidationResponseDto {
  @ApiProperty({
    description: 'Whether the ZIP code is valid',
    example: true
  })
  isValid: boolean

  @ApiProperty({
    description: 'Formatted ZIP code',
    example: '12345',
    required: false
  })
  zipCode?: string

  @ApiProperty({
    description: 'ZIP code type',
    example: 'ZIP5',
    enum: ['ZIP5', 'ZIP9'],
    required: false
  })
  zipCodeType?: string

  @ApiProperty({
    description: 'State abbreviation',
    example: 'NY',
    required: false
  })
  state?: string

  @ApiProperty({
    description: 'US region',
    example: 'Northeast',
    enum: ['Northeast', 'South', 'Midwest', 'West', 'UNKNOWN'],
    required: false
  })
  region?: string

  @ApiProperty({
    description: 'Error message if validation failed',
    example: 'ZIP code must be 5 digits (12345) or 9 digits (12345-6789)',
    required: false
  })
  errorMessage?: string
}