import { IsArray, IsInt } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CheckinDto {
  @ApiProperty({ type: [Number], description: 'Array of registration IDs to check in' })
  @IsArray()
  @IsInt({ each: true })
  registrationIds: number[]
}