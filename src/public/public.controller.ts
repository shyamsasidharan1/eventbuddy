import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBadRequestResponse, ApiNotFoundResponse, ApiParam } from '@nestjs/swagger'
import { PublicService } from './public.service'
import { ValidationService } from './validation.service'
import { RegisterRequestDto } from './dto/register-request.dto'
import { ValidatePhoneDto, PhoneValidationResponseDto } from './dto/validate-phone.dto'
import { ValidateZipCodeDto, ZipCodeValidationResponseDto } from './dto/validate-zipcode.dto'

@ApiTags('Public Registration')
@Controller('api/v1/public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly validationService: ValidationService
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Submit membership registration request',
    description: 'Allows public users to request membership in an organization. Requires admin approval.'
  })
  @ApiResponse({
    status: 200,
    description: 'Registration request submitted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Registration request submitted successfully' },
        requestId: { type: 'number', example: 123 },
        organizationName: { type: 'string', example: 'Sample Charity Organization' },
        status: { type: 'string', example: 'PENDING_APPROVAL' }
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Invalid request data, duplicate email, or user already exists',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { 
          type: 'string', 
          examples: [
            'You are already an active member of this organization',
            'You have already submitted a registration request for this organization',
            'Either orgId or orgWebUrl must be provided'
          ]
        },
        error: { type: 'string', example: 'Bad Request' }
      }
    }
  })
  @ApiNotFoundResponse({
    description: 'Organization not found or inactive',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Organization not found or inactive' },
        error: { type: 'string', example: 'Not Found' }
      }
    }
  })
  async submitRegistrationRequest(@Body() registerRequestDto: RegisterRequestDto) {
    return this.publicService.submitRegistrationRequest(registerRequestDto)
  }

  @Get('organizations/:identifier')
  @ApiOperation({ 
    summary: 'Get organization information',
    description: 'Retrieve public information about an organization by ID or web URL'
  })
  @ApiParam({
    name: 'identifier',
    description: 'Organization ID (number) or web URL (string)',
    example: 'sample-charity.org'
  })
  @ApiResponse({
    status: 200,
    description: 'Organization information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'Sample Charity Organization' },
        webUrl: { type: 'string', example: 'sample-charity.org' }
      }
    }
  })
  @ApiNotFoundResponse({
    description: 'Organization not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: { type: 'string', example: 'Organization not found' },
        error: { type: 'string', example: 'Not Found' }
      }
    }
  })
  async getOrganizationInfo(@Param('identifier') identifier: string) {
    return this.publicService.getOrganizationInfo(identifier)
  }

  @Post('validate/phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate US phone number',
    description: 'Validates a US phone number format and returns formatting information and number type'
  })
  @ApiResponse({
    status: 200,
    description: 'Phone number validation result',
    type: PhoneValidationResponseDto
  })
  async validatePhone(@Body() validatePhoneDto: ValidatePhoneDto): Promise<PhoneValidationResponseDto> {
    return this.validationService.validatePhoneNumber(validatePhoneDto.phone)
  }

  @Post('validate/zipcode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Validate US ZIP code',
    description: 'Validates a US ZIP code format and returns location information'
  })
  @ApiResponse({
    status: 200,
    description: 'ZIP code validation result',
    type: ZipCodeValidationResponseDto
  })
  async validateZipCode(@Body() validateZipCodeDto: ValidateZipCodeDto): Promise<ZipCodeValidationResponseDto> {
    return this.validationService.getZipCodeInfo(validateZipCodeDto.zipCode)
  }

  @Get('validate/phone/:phone')
  @ApiOperation({
    summary: 'Validate US phone number (GET)',
    description: 'Validates a US phone number via URL parameter'
  })
  @ApiParam({
    name: 'phone',
    description: 'Phone number to validate (URL encoded)',
    example: '%28555%29%20123-4567'
  })
  @ApiResponse({
    status: 200,
    description: 'Phone number validation result',
    type: PhoneValidationResponseDto
  })
  async validatePhoneGet(@Param('phone') phone: string): Promise<PhoneValidationResponseDto> {
    return this.validationService.validatePhoneNumber(decodeURIComponent(phone))
  }

  @Get('validate/zipcode/:zipCode')
  @ApiOperation({
    summary: 'Validate US ZIP code (GET)',
    description: 'Validates a US ZIP code via URL parameter'
  })
  @ApiParam({
    name: 'zipCode',
    description: 'ZIP code to validate',
    example: '12345'
  })
  @ApiResponse({
    status: 200,
    description: 'ZIP code validation result',
    type: ZipCodeValidationResponseDto
  })
  async validateZipCodeGet(@Param('zipCode') zipCode: string): Promise<ZipCodeValidationResponseDto> {
    return this.validationService.getZipCodeInfo(zipCode)
  }
}