import { IsString, IsOptional, IsEmail, IsDateString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class UpdateMemberDto {
  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @IsString()
  firstName?: string

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  lastName?: string

  @ApiProperty({ example: '1234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string

  @ApiProperty({ example: '1990-01-01', required: false })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string

  @ApiProperty({ example: 'Male', required: false })
  @IsOptional()
  @IsString()
  gender?: string

  @ApiProperty({ example: '123 Main St, City, State 12345', required: false })
  @IsOptional()
  @IsString()
  address?: string

  @ApiProperty({ example: 'Jane Doe - 0987654321', required: false })
  @IsOptional()
  @IsString()
  emergencyContact?: string

  @ApiProperty({ example: 'Peanuts, shellfish', required: false })
  @IsOptional()
  @IsString()
  allergies?: string

  @ApiProperty({ example: 'Prefers vegetarian meals', required: false })
  @IsOptional()
  @IsString()
  notes?: string
}