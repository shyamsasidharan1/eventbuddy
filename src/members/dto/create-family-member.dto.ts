import { IsString, IsOptional, IsDateString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateFamilyMemberDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  firstName: string

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string

  @ApiProperty({ example: '1995-05-15' })
  @IsDateString()
  dateOfBirth: string

  @ApiProperty({ example: 'spouse', required: false })
  @IsOptional()
  @IsString()
  relationship?: string

  @ApiProperty({ example: 'Female', required: false })
  @IsOptional()
  @IsString()
  gender?: string

  @ApiProperty({ example: 'Lactose intolerant', required: false })
  @IsOptional()
  @IsString()
  allergies?: string

  @ApiProperty({ example: 'Has dietary restrictions', required: false })
  @IsOptional()
  @IsString()
  notes?: string
}