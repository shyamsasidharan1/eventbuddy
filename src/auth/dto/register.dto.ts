import { IsEmail, IsString, MinLength, IsOptional, IsNumberString, IsEnum, IsDecimal } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { MembershipCategory } from '@prisma/client'

export class RegisterDto {
  @ApiProperty({ example: 'member@charity.org' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'securePassword123' })
  @IsString()
  @MinLength(6)
  password: string

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string

  @ApiProperty({ example: '1234567890' })
  @IsString()
  phone: string

  @ApiProperty({ example: '1' })
  @IsNumberString()
  orgId: string

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

  @ApiProperty({ enum: MembershipCategory, required: false, description: 'Membership category' })
  @IsOptional()
  @IsEnum(MembershipCategory)
  membershipCategory?: MembershipCategory

  @ApiProperty({ example: '50.00', required: false, description: 'Membership fee amount' })
  @IsOptional()
  @IsString()
  membershipFee?: string

  @ApiProperty({ example: 'Board member since 2020', required: false })
  @IsOptional()
  @IsString()
  membershipNotes?: string
}