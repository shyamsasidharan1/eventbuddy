import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty } from '@nestjs/swagger'

export enum RegistrantType {
  MEMBER = 'member',
  FAMILY = 'family'
}

export class RegistrantDto {
  @ApiProperty({ enum: RegistrantType, description: 'Type of registrant' })
  @IsEnum(RegistrantType)
  type: RegistrantType

  @ApiProperty({ description: 'ID of the member or family member' })
  @IsInt()
  id: number

  @ApiProperty({ required: false, description: 'Custom registration data for event-specific fields' })
  @IsOptional()
  customData?: Record<string, any>

  @ApiProperty({ required: false, description: 'Notes about this registration' })
  @IsOptional()
  @IsString()
  notes?: string
}

export class CreateRegistrationDto {
  @ApiProperty({ type: [RegistrantDto], description: 'List of people to register for the event' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RegistrantDto)
  @IsNotEmpty()
  registrants: RegistrantDto[]
}