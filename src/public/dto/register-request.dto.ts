import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsString, MaxLength, MinLength, IsOptional, IsUrl, Matches, Length } from 'class-validator'

export class RegisterRequestDto {
  @ApiProperty({
    description: 'Organization identifier (either orgId or webUrl)',
    example: 1,
    oneOf: [
      { type: 'number', description: 'Organization ID' },
      { type: 'string', description: 'Organization web URL' }
    ]
  })
  @IsOptional()
  orgId?: number

  @ApiPropertyOptional({
    description: 'Organization web URL (alternative to orgId)',
    example: 'sample-charity.org'
  })
  @IsOptional()
  @IsUrl({ require_protocol: false })
  orgWebUrl?: string

  @ApiProperty({
    description: 'Email address for the membership request',
    example: 'john.doe@example.com'
  })
  @IsEmail()
  email: string

  @ApiProperty({
    description: 'First name of the applicant',
    example: 'John',
    maxLength: 100
  })
  @IsString()
  @MaxLength(100)
  firstName: string

  @ApiProperty({
    description: 'Last name of the applicant',
    example: 'Doe',
    maxLength: 100
  })
  @IsString()
  @MaxLength(100)
  lastName: string

  @ApiPropertyOptional({
    description: 'Phone number (US format)',
    example: '(555) 123-4567',
    pattern: '^[\\+]?[1-9]?[0-9]{7,15}$'
  })
  @IsOptional()
  @IsString()
  @Matches(/^[\+]?[1-9]?[\d\s\-\(\)\.]{7,20}$/, {
    message: 'Phone number must be a valid format (e.g., (555) 123-4567, 555-123-4567, +1-555-123-4567)'
  })
  phone?: string

  @ApiPropertyOptional({
    description: 'USA ZIP code (5 or 9 digits)',
    example: '12345',
    pattern: '^\\d{5}(-\\d{4})?$'
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}(-\d{4})?$/, {
    message: 'ZIP code must be 5 digits (12345) or 9 digits (12345-6789)'
  })
  zipCode?: string

  @ApiPropertyOptional({
    description: 'Message to organization explaining interest in membership',
    example: 'I would like to join your organization to support your charitable mission.',
    minLength: 10,
    maxLength: 1000
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  requestMessage?: string
}