import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

export class InactivateMemberDto {
  @ApiProperty({
    description: 'Reason for member inactivation',
    example: 'Member requested account deactivation',
    minLength: 5,
    maxLength: 500
  })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string
}