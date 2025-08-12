import { Controller, Get, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { MembersService } from './members.service'
import { UpdateMemberDto } from './dto/update-member.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@prisma/client'

@ApiTags('Members')
@Controller('members')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @Roles(UserRole.ORG_ADMIN, UserRole.EVENT_STAFF)
  @ApiOperation({ summary: 'Get all members in organization' })
  @ApiResponse({ status: 200, description: 'Members retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findAll(@Request() req) {
    return this.membersService.findAll(parseInt(req.user.orgId), req.user.role)
  }

  @Get('stats')
  @Roles(UserRole.ORG_ADMIN, UserRole.EVENT_STAFF)
  @ApiOperation({ summary: 'Get member statistics' })
  @ApiResponse({ status: 200, description: 'Member statistics retrieved' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getStats(@Request() req) {
    return this.membersService.getMemberStats(parseInt(req.user.orgId), req.user.role)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get member by ID' })
  @ApiResponse({ status: 200, description: 'Member retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.membersService.findOne(id, parseInt(req.user.orgId), req.user.sub, req.user.role)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update member profile' })
  @ApiResponse({ status: 200, description: 'Member updated successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async update(
    @Param('id') id: string,
    @Body() updateMemberDto: UpdateMemberDto,
    @Request() req,
  ) {
    return this.membersService.update(id, updateMemberDto, parseInt(req.user.orgId), req.user.sub, req.user.role)
  }

  @Delete(':id')
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Deactivate member (Admin only)' })
  @ApiResponse({ status: 200, description: 'Member deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async deactivate(@Param('id') id: string, @Request() req) {
    return this.membersService.deactivate(id, parseInt(req.user.orgId), req.user.role)
  }
}