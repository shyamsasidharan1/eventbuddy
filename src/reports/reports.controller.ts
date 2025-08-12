import { Controller, Get, Query, UseGuards, Request, Res } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { Response } from 'express'
import { ReportsService } from './reports.service'
import { ReportFiltersDto } from './dto/report-filters.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@prisma/client'

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('membership')
  @Roles(UserRole.ORG_ADMIN, UserRole.EVENT_STAFF)
  @ApiOperation({ summary: 'Get membership report (Admin/Staff only)' })
  @ApiResponse({ status: 200, description: 'Membership report generated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'membershipCategory', required: false, enum: ['REGULAR', 'PREMIUM', 'LIFE', 'EXECUTIVE_BOARD', 'HONORARY', 'STUDENT', 'SENIOR'] })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async getMembershipReport(
    @Query() filters: ReportFiltersDto,
    @Request() req,
    @Res() res: Response
  ) {
    const report = await this.reportsService.getMembershipReport(
      parseInt(req.user.orgId),
      req.user.role,
      filters
    )

    if (filters.format === 'csv') {
      const csvContent = await this.reportsService.exportToCsv('membership', report)
      const fileName = `membership-report-${new Date().toISOString().split('T')[0]}.csv`
      
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      })
      res.send(csvContent)
      return
    }

    res.json(report)
  }

  @Get('registrations')
  @Roles(UserRole.ORG_ADMIN, UserRole.EVENT_STAFF)
  @ApiOperation({ summary: 'Get event registrations report (Admin/Staff only)' })
  @ApiResponse({ status: 200, description: 'Event registrations report generated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'eventId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'WAITLISTED'] })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async getEventRegistrationsReport(
    @Query() filters: ReportFiltersDto,
    @Request() req,
    @Res() res: Response
  ) {
    const report = await this.reportsService.getEventRegistrationsReport(
      parseInt(req.user.orgId),
      req.user.role,
      filters
    )

    if (filters.format === 'csv') {
      const csvContent = await this.reportsService.exportToCsv('registrations', report)
      const fileName = `registrations-report-${new Date().toISOString().split('T')[0]}.csv`
      
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      })
      res.send(csvContent)
      return
    }

    res.json(report)
  }

  @Get('attendance')
  @Roles(UserRole.ORG_ADMIN, UserRole.EVENT_STAFF)
  @ApiOperation({ summary: 'Get attendance report (Admin/Staff only)' })
  @ApiResponse({ status: 200, description: 'Attendance report generated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'eventId', required: false, type: Number })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async getAttendanceReport(
    @Query() filters: ReportFiltersDto,
    @Request() req,
    @Res() res: Response
  ) {
    const report = await this.reportsService.getAttendanceReport(
      parseInt(req.user.orgId),
      req.user.role,
      filters
    )

    if (filters.format === 'csv') {
      const csvContent = await this.reportsService.exportToCsv('attendance', report)
      const fileName = `attendance-report-${new Date().toISOString().split('T')[0]}.csv`
      
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      })
      res.send(csvContent)
      return
    }

    res.json(report)
  }

  @Get('financial')
  @Roles(UserRole.ORG_ADMIN)
  @ApiOperation({ summary: 'Get financial report (Admin only)' })
  @ApiResponse({ status: 200, description: 'Financial report generated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiQuery({ name: 'membershipCategory', required: false, enum: ['REGULAR', 'PREMIUM', 'LIFE', 'EXECUTIVE_BOARD', 'HONORARY', 'STUDENT', 'SENIOR'] })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async getFinancialReport(
    @Query() filters: ReportFiltersDto,
    @Request() req,
    @Res() res: Response
  ) {
    const report = await this.reportsService.getFinancialReport(
      parseInt(req.user.orgId),
      req.user.role,
      filters
    )

    if (filters.format === 'csv') {
      const csvContent = await this.reportsService.exportToCsv('financial', report)
      const fileName = `financial-report-${new Date().toISOString().split('T')[0]}.csv`
      
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      })
      res.send(csvContent)
      return
    }

    res.json(report)
  }

  @Get('dashboard')
  @Roles(UserRole.ORG_ADMIN, UserRole.EVENT_STAFF)
  @ApiOperation({ summary: 'Get dashboard summary (Admin/Staff only)' })
  @ApiResponse({ status: 200, description: 'Dashboard summary generated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getDashboardSummary(@Request() req) {
    const [membershipReport, registrationsReport, attendanceReport] = await Promise.all([
      this.reportsService.getMembershipReport(parseInt(req.user.orgId), req.user.role, {}),
      this.reportsService.getEventRegistrationsReport(parseInt(req.user.orgId), req.user.role, {}),
      this.reportsService.getAttendanceReport(parseInt(req.user.orgId), req.user.role, {}),
    ])

    // Get financial summary only for admins
    let financialSummary = null
    if (req.user.role === UserRole.ORG_ADMIN) {
      const financialReport = await this.reportsService.getFinancialReport(
        parseInt(req.user.orgId),
        req.user.role,
        {}
      )
      financialSummary = financialReport.summary
    }

    return {
      membership: membershipReport.summary,
      registrations: registrationsReport.summary,
      attendance: attendanceReport.summary,
      financial: financialSummary,
      generatedAt: new Date().toISOString(),
    }
  }
}