import { IsString, IsInt, IsOptional, IsDateString, IsBoolean, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'

export class CreateEventDto {
  @ApiProperty({ example: 'Annual Charity Gala' })
  @IsString()
  title: string

  @ApiProperty({ example: 'Join us for an evening of fundraising and community celebration', required: false })
  @IsOptional()
  @IsString()
  description?: string

  @ApiProperty({ example: 100 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacity: number

  @ApiProperty({ example: 120, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxCapacity?: number

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  waitlistEnabled?: boolean

  @ApiProperty({ example: '2025-12-01T18:00:00Z' })
  @IsDateString()
  startsAt: string

  @ApiProperty({ example: '2025-12-01T22:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  endsAt?: string

  @ApiProperty({ example: 'Community Center, 123 Main St', required: false })
  @IsOptional()
  @IsString()
  location?: string

  @ApiProperty({ example: { dietaryRestrictions: 'text', specialNeeds: 'text' }, required: false })
  @IsOptional()
  customFields?: any

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean
}