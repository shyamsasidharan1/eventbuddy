import { IsEnum, IsOptional, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { RegStatus } from '@prisma/client'

export class UpdateRegistrationDto {
  @ApiProperty({ enum: RegStatus, required: false, description: 'Registration status' })
  @IsOptional()
  @IsEnum(RegStatus)
  status?: RegStatus

  @ApiProperty({ required: false, description: 'Staff notes about this registration' })
  @IsOptional()
  @IsString()
  notes?: string

  @ApiProperty({ required: false, description: 'Custom registration data' })
  @IsOptional()
  customData?: Record<string, any>
}