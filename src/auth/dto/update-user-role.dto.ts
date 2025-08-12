import { IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { UserRole } from '@prisma/client'

export class UpdateUserRoleDto {
  @ApiProperty({ enum: UserRole, description: 'New role to assign to the user' })
  @IsEnum(UserRole)
  role: UserRole
}