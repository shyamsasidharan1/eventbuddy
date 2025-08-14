import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength, Matches } from 'class-validator'

export class AcceptInviteDto {
  @ApiProperty({
    description: 'Invitation token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  @IsString()
  token: string

  @ApiProperty({
    description: 'New password for the account',
    example: 'SecurePassword123!',
    minLength: 8
  })
  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
    }
  )
  password: string
}