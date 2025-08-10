import { IsEmail, IsString, MinLength, IsOptional, IsNumberString, IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { UserRole, MembershipCategory } from '@prisma/client'

export class CreateAdminDto {
  @ApiProperty({ example: 'admin@charity.org' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'securePassword123' })
  @IsString()
  @MinLength(8)
  password: string

  @ApiProperty({ example: 'Jane' })
  @IsString()
  firstName: string

  @ApiProperty({ example: 'Smith' })
  @IsString()
  lastName: string

  @ApiProperty({ example: '1234567890' })
  @IsString()
  phone: string

  @ApiProperty({ enum: UserRole, description: 'Role to assign to the new admin' })
  @IsEnum(UserRole)
  role: UserRole

  @ApiProperty({ enum: MembershipCategory, required: false, description: 'Membership category' })
  @IsOptional()
  @IsEnum(MembershipCategory)
  membershipCategory?: MembershipCategory

  @ApiProperty({ example: 'Organization Administrator', required: false })
  @IsOptional()
  @IsString()
  membershipNotes?: string

  @ApiProperty({ example: 'Jane Doe - 0987654321', required: false })
  @IsOptional()
  @IsString()
  emergencyContact?: string
}