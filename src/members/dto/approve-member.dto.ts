import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator'

export class ApproveMemberDto {
  @ApiProperty({
    description: 'Whether to approve or deny the membership request',
    example: true
  })
  @IsBoolean()
  approve: boolean

  @ApiPropertyOptional({
    description: 'Optional message for the applicant (for both approval and denial)',
    example: 'Welcome to our organization! Please check your email for next steps.',
    maxLength: 1000
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string

  @ApiPropertyOptional({
    description: 'Reason for denial (required if approve is false)',
    example: 'Application does not meet our membership criteria',
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  denialReason?: string
}