import { IsOptional, IsDateString, IsEnum, IsString, IsInt, Min } from 'class-validator'
import { Type, Transform } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'
import { RegStatus, MembershipCategory, UserRole } from '@prisma/client'

export class ReportFiltersDto {
  @ApiProperty({ required: false, description: 'Start date for the report period' })
  @IsOptional()
  @IsDateString()
  startDate?: string

  @ApiProperty({ required: false, description: 'End date for the report period' })
  @IsOptional()
  @IsDateString()
  endDate?: string

  @ApiProperty({ required: false, description: 'Event ID to filter by' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  eventId?: number

  @ApiProperty({ enum: RegStatus, required: false, description: 'Registration status filter' })
  @IsOptional()
  @IsEnum(RegStatus)
  status?: RegStatus

  @ApiProperty({ enum: MembershipCategory, required: false, description: 'Membership category filter' })
  @IsOptional()
  @IsEnum(MembershipCategory)
  membershipCategory?: MembershipCategory

  @ApiProperty({ required: false, description: 'Include inactive records', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeInactive?: boolean = false

  @ApiProperty({ required: false, description: 'Export format', enum: ['json', 'csv'], default: 'json' })
  @IsOptional()
  @IsEnum(['json', 'csv'])
  format?: 'json' | 'csv' = 'json'
}