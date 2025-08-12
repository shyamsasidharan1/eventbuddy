import { Controller, Get, Post, Put, Param, Body, UseGuards, Request, Query, HttpCode } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger'
import { RegistrationsService } from './registrations.service'
import { CreateRegistrationDto } from './dto/create-registration.dto'
import { UpdateRegistrationDto } from './dto/update-registration.dto'
import { CheckinDto } from './dto/checkin.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@prisma/client'

@ApiTags('Registrations')
@Controller('registrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Post('events/:eventId/register')
  @ApiOperation({ summary: 'Register people for an event' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({ status: 201, description: 'Registration(s) created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid registration data or capacity issues' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async registerForEvent(
    @Param('eventId') eventId: string,
    @Body() createRegistrationDto: CreateRegistrationDto,
    @Request() req
  ) {
    return this.registrationsService.registerForEvent(
      eventId,
      createRegistrationDto,
      parseInt(req.user.orgId),
      parseInt(req.user.sub),
      req.user.role
    )
  }

  @Get('events/:eventId')
  @Roles(UserRole.ORG_ADMIN, UserRole.EVENT_STAFF)
  @ApiOperation({ summary: 'Get all registrations for an event (Admin/Staff only)' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Event registrations retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async getEventRegistrations(
    @Param('eventId') eventId: string,
    @Request() req
  ) {
    return this.registrationsService.getEventRegistrations(
      eventId,
      parseInt(req.user.orgId),
      req.user.role
    )
  }

  @Get('my-registrations')
  @ApiOperation({ summary: 'Get current user\'s registrations' })
  @ApiResponse({ status: 200, description: 'User registrations retrieved successfully' })
  async getUserRegistrations(@Request() req) {
    return this.registrationsService.getUserRegistrations(
      parseInt(req.user.orgId),
      parseInt(req.user.sub)
    )
  }

  @Put(':id')
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Update registration status (Admin only)' })
  @ApiParam({ name: 'id', description: 'Registration ID' })
  @ApiResponse({ status: 200, description: 'Registration updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Registration not found' })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  async updateRegistration(
    @Param('id') id: string,
    @Body() updateRegistrationDto: UpdateRegistrationDto,
    @Request() req
  ) {
    return this.registrationsService.updateRegistration(
      id,
      updateRegistrationDto,
      parseInt(req.user.orgId),
      req.user.role
    )
  }

  @Post('events/:eventId/checkin')
  @HttpCode(200)
  @Roles(UserRole.ORG_ADMIN, UserRole.EVENT_STAFF)
  @ApiOperation({ summary: 'Check in attendees for an event (Admin/Staff only)' })
  @ApiParam({ name: 'eventId', description: 'Event ID' })
  @ApiResponse({ status: 200, description: 'Attendees checked in successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 400, description: 'Invalid check-in data' })
  async checkinAttendees(
    @Param('eventId') eventId: string,
    @Body() checkinDto: CheckinDto,
    @Request() req
  ) {
    return this.registrationsService.checkinAttendees(
      eventId,
      checkinDto,
      parseInt(req.user.orgId),
      parseInt(req.user.sub),
      req.user.role
    )
  }
}