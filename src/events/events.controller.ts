import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { EventsService } from './events.service'
import { CreateEventDto } from './dto/create-event.dto'
import { UpdateEventDto } from './dto/update-event.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@prisma/client'

@ApiTags('Events')
@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Create new event (Admin only)' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 400, description: 'Invalid event data' })
  async create(@Body() createEventDto: CreateEventDto, @Request() req) {
    return this.eventsService.create(createEventDto, parseInt(req.user.orgId), req.user.role)
  }

  @Get()
  @ApiOperation({ summary: 'Get all events in organization' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Events retrieved successfully' })
  async findAll(
    @Request() req,
    @Query('includeInactive') includeInactive?: boolean
  ) {
    return this.eventsService.findAll(parseInt(req.user.orgId), req.user.role, includeInactive)
  }

  @Get('stats')
  @Roles(UserRole.ORG_ADMIN, UserRole.EVENT_STAFF)
  @ApiOperation({ summary: 'Get event statistics' })
  @ApiResponse({ status: 200, description: 'Event statistics retrieved' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getStats(@Request() req) {
    return this.eventsService.getEventStats(parseInt(req.user.orgId), req.user.role)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiResponse({ status: 200, description: 'Event retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.eventsService.findOne(id, parseInt(req.user.orgId))
  }

  @Get(':id/capacity')
  @ApiOperation({ summary: 'Check event capacity and availability' })
  @ApiResponse({ status: 200, description: 'Capacity information retrieved' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  async checkCapacity(@Param('id') id: string, @Request() req) {
    return this.eventsService.checkCapacity(id, parseInt(req.user.orgId))
  }

  @Put(':id')
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Update event (Admin only)' })
  @ApiResponse({ status: 200, description: 'Event updated successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 400, description: 'Invalid event data' })
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @Request() req,
  ) {
    return this.eventsService.update(id, updateEventDto, parseInt(req.user.orgId), req.user.role)
  }

  @Delete(':id')
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Deactivate event (Admin only)' })
  @ApiResponse({ status: 200, description: 'Event deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Event not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async deactivate(@Param('id') id: string, @Request() req) {
    return this.eventsService.deactivate(id, parseInt(req.user.orgId), req.user.role)
  }
}