import { IsEmail, IsString, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'admin@charity.org' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'securePassword123' })
  @IsString()
  @MinLength(6)
  password: string
}