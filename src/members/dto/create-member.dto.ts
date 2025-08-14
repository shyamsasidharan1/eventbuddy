import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateMemberDto {
  @ApiProperty({
    description: 'Member email address',
    example: 'john.doe@example.com'
  })
  @IsEmail()
  email: string

  @ApiPropertyOptional({
    description: 'Member first name',
    example: 'John',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string

  @ApiPropertyOptional({
    description: 'Member last name',
    example: 'Doe',
    maxLength: 100
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string
}