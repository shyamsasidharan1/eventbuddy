import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger'
import { FamilyService } from './family.service'
import { CreateFamilyMemberDto } from './dto/create-family-member.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@ApiTags('Family Members')
@Controller('members/:memberId/family')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class FamilyController {
  constructor(private readonly familyService: FamilyService) {}

  @Post()
  @ApiOperation({ summary: 'Add family member to member profile' })
  @ApiResponse({ status: 201, description: 'Family member added successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async create(
    @Param('memberId') memberId: string,
    @Body() createFamilyMemberDto: CreateFamilyMemberDto,
    @Request() req,
  ) {
    return this.familyService.create(
      memberId,
      createFamilyMemberDto,
      parseInt(req.user.orgId),
      req.user.sub,
      req.user.role,
    )
  }

  @Get()
  @ApiOperation({ summary: 'Get all family members for a member' })
  @ApiResponse({ status: 200, description: 'Family members retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findByMember(@Param('memberId') memberId: string, @Request() req) {
    return this.familyService.findByMember(
      memberId,
      parseInt(req.user.orgId),
      req.user.sub,
      req.user.role,
    )
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update family member' })
  @ApiResponse({ status: 200, description: 'Family member updated successfully' })
  @ApiResponse({ status: 404, description: 'Family member not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateFamilyMemberDto>,
    @Request() req,
  ) {
    return this.familyService.update(
      id,
      updateData,
      parseInt(req.user.orgId),
      req.user.sub,
      req.user.role,
    )
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove family member' })
  @ApiResponse({ status: 200, description: 'Family member removed successfully' })
  @ApiResponse({ status: 404, description: 'Family member not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async remove(@Param('id') id: string, @Request() req) {
    return this.familyService.remove(
      id,
      parseInt(req.user.orgId),
      req.user.sub,
      req.user.role,
    )
  }
}