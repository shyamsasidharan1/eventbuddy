import { Controller, Get, Put, Delete, Post, Param, Body, UseGuards, Request, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { MembersService } from './members.service'
import { UpdateMemberDto } from './dto/update-member.dto'
import { CreateMemberDto } from './dto/create-member.dto'
import { InactivateMemberDto } from './dto/inactivate-member.dto'
import { ApproveMemberDto } from './dto/approve-member.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole, MembershipStatus } from '@prisma/client'

@ApiTags('Members')
@Controller('members')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @Roles(UserRole.ORG_ADMIN, UserRole.EVENT_STAFF)
  @ApiOperation({ summary: 'Get all members in organization' })
  @ApiQuery({ name: 'status', required: false, enum: MembershipStatus, description: 'Filter by membership status' })
  @ApiQuery({ name: 'query', required: false, type: 'string', description: 'Search query for member names' })
  @ApiQuery({ name: 'page', required: false, type: 'number', description: 'Page number (1-based)' })
  @ApiQuery({ name: 'pageSize', required: false, type: 'number', description: 'Number of items per page' })
  @ApiResponse({ status: 200, description: 'Members retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findAll(
    @Request() req,
    @Query('status') status?: MembershipStatus,
    @Query('query') query?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.membersService.findAll({
      orgId: parseInt(req.user.orgId),
      role: req.user.role,
      status,
      query,
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined
    })
  }

  @Get('stats')
  @Roles(UserRole.ORG_ADMIN, UserRole.EVENT_STAFF)
  @ApiOperation({ summary: 'Get member statistics' })
  @ApiResponse({ status: 200, description: 'Member statistics retrieved' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getStats(@Request() req) {
    return this.membersService.getMemberStats(parseInt(req.user.orgId), req.user.role)
  }

  @Get('pending-approvals')
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ 
    summary: 'Get pending registration requests (Admin only)',
    description: 'Get all members with PENDING_APPROVAL status for admin review'
  })
  @ApiQuery({ name: 'page', required: false, type: 'number', description: 'Page number (1-based)' })
  @ApiQuery({ name: 'pageSize', required: false, type: 'number', description: 'Number of items per page' })
  @ApiResponse({ 
    status: 200, 
    description: 'Pending approvals retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 123 },
              firstName: { type: 'string', example: 'John' },
              lastName: { type: 'string', example: 'Doe' },
              membershipStatus: { type: 'string', example: 'PENDING_APPROVAL' },
              registrationRequestedAt: { type: 'string', format: 'date-time' },
              registrationMessage: { type: 'string', example: 'I would like to join your organization' },
              user: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'john.doe@example.com' },
                  createdAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 1 },
            pageSize: { type: 'number', example: 20 },
            total: { type: 'number', example: 5 },
            totalPages: { type: 'number', example: 1 }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (Admin only)' })
  async getPendingApprovals(
    @Request() req,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.membersService.getPendingApprovals({
      orgId: parseInt(req.user.orgId),
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 20
    })
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

  @Post()
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ 
    summary: 'Invite new member (Admin only)',
    description: 'Send invitation email to new member and create pending member profile'
  })
  @ApiResponse({ status: 201, description: 'Member invitation sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid email or member already exists' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async invite(@Body() createMemberDto: CreateMemberDto, @Request() req) {
    return this.membersService.invite({
      orgId: parseInt(req.user.orgId),
      invitedByUserId: req.user.sub,
      email: createMemberDto.email,
      firstName: createMemberDto.firstName,
      lastName: createMemberDto.lastName
    })
  }

  @Post(':id/inactivate')
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ 
    summary: 'Inactivate member with reason (Admin only)',
    description: 'Mark member as inactive with detailed reason for audit trail'
  })
  @ApiResponse({ status: 200, description: 'Member inactivated successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  @ApiResponse({ status: 400, description: 'Member already inactive' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async inactivate(
    @Param('id') id: string,
    @Body() inactivateMemberDto: InactivateMemberDto,
    @Request() req
  ) {
    return this.membersService.inactivate({
      id: parseInt(id),
      orgId: parseInt(req.user.orgId),
      reason: inactivateMemberDto.reason,
      actorId: req.user.sub
    })
  }

  @Post(':id/activate')
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ 
    summary: 'Reactivate member (Admin only)',
    description: 'Reactivate an inactive member'
  })
  @ApiResponse({ status: 200, description: 'Member reactivated successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  @ApiResponse({ status: 400, description: 'Member already active' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async activate(@Param('id') id: string, @Request() req) {
    return this.membersService.activate({
      id: parseInt(id),
      orgId: parseInt(req.user.orgId),
      actorId: req.user.sub
    })
  }

  @Post(':id/approve')
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ 
    summary: 'Approve or deny registration request (Admin only)',
    description: 'Approve or deny a pending membership registration request'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Registration request processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Member approved successfully' },
        member: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 123 },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            membershipStatus: { type: 'string', example: 'ACTIVE' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Member not found or not pending approval' })
  @ApiResponse({ status: 400, description: 'Invalid approval data or member not in pending status' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async approveRegistration(
    @Param('id') id: string,
    @Body() approveMemberDto: ApproveMemberDto,
    @Request() req
  ) {
    return this.membersService.approveRegistration({
      memberId: parseInt(id),
      orgId: parseInt(req.user.orgId),
      approve: approveMemberDto.approve,
      message: approveMemberDto.message,
      denialReason: approveMemberDto.denialReason,
      actorId: req.user.sub
    })
  }
}