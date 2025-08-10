import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../config/prisma.service'
import { ReportFiltersDto } from './dto/report-filters.dto'
import { UserRole, RegStatus, MembershipCategory } from '@prisma/client'

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getMembershipReport(
    userOrgId: number,
    userRole: UserRole,
    filters: ReportFiltersDto
  ) {
    // Only ORG_ADMIN and EVENT_STAFF can view reports
    if (!([UserRole.ORG_ADMIN, UserRole.EVENT_STAFF] as UserRole[]).includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions to view reports')
    }

    const whereClause: any = {
      orgId: userOrgId,
    }

    if (!filters.includeInactive) {
      whereClause.isActive = true
    }

    if (filters.membershipCategory) {
      whereClause.membershipCategory = filters.membershipCategory
    }

    if (filters.startDate || filters.endDate) {
      whereClause.createdAt = {}
      if (filters.startDate) {
        whereClause.createdAt.gte = new Date(filters.startDate)
      }
      if (filters.endDate) {
        whereClause.createdAt.lte = new Date(filters.endDate)
      }
    }

    const members = await this.prisma.memberProfile.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            email: true,
            role: true,
            lastLoginAt: true,
            createdAt: true,
            isActive: true,
          }
        },
        family: {
          where: filters.includeInactive ? {} : { isActive: true },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            relationship: true,
            dateOfBirth: true,
            isActive: true,
          }
        }
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    })

    const summary = {
      totalMembers: members.length,
      activeMembers: members.filter(m => m.isActive).length,
      inactiveMembers: members.filter(m => !m.isActive).length,
      totalFamilyMembers: members.reduce((sum, m) => sum + m.family.length, 0),
      membershipCategoryBreakdown: this.getMembershipCategoryBreakdown(members),
      paymentStatus: this.getPaymentStatusBreakdown(members),
    }

    return {
      summary,
      members,
      generatedAt: new Date().toISOString(),
      filters
    }
  }

  async getEventRegistrationsReport(
    userOrgId: number,
    userRole: UserRole,
    filters: ReportFiltersDto
  ) {
    if (!([UserRole.ORG_ADMIN, UserRole.EVENT_STAFF] as UserRole[]).includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions to view reports')
    }

    const whereClause: any = {
      orgId: userOrgId,
    }

    if (filters.eventId) {
      whereClause.eventId = filters.eventId
    }

    if (filters.status) {
      whereClause.status = filters.status
    }

    if (filters.startDate || filters.endDate) {
      whereClause.registeredAt = {}
      if (filters.startDate) {
        whereClause.registeredAt.gte = new Date(filters.startDate)
      }
      if (filters.endDate) {
        whereClause.registeredAt.lte = new Date(filters.endDate)
      }
    }

    const registrations = await this.prisma.registration.findMany({
      where: whereClause,
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            location: true,
            capacity: true,
            maxCapacity: true,
          }
        },
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            membershipCategory: true,
            user: {
              select: {
                email: true,
              }
            }
          }
        },
        familyMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            relationship: true,
            phone: true,
            email: true,
          }
        },
        checkedInBy: {
          select: {
            memberProfile: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        }
      },
      orderBy: [
        { event: { startsAt: 'desc' } },
        { registeredAt: 'asc' }
      ]
    })

    const summary = {
      totalRegistrations: registrations.length,
      statusBreakdown: {
        confirmed: registrations.filter(r => r.status === RegStatus.CONFIRMED).length,
        pending: registrations.filter(r => r.status === RegStatus.PENDING).length,
        waitlisted: registrations.filter(r => r.status === RegStatus.WAITLISTED).length,
        cancelled: registrations.filter(r => r.status === RegStatus.CANCELLED).length,
      },
      checkedInCount: registrations.filter(r => r.checkedIn).length,
      uniqueEvents: [...new Set(registrations.map(r => r.eventId))].length,
      uniqueMembers: [...new Set(registrations.filter(r => r.memberId).map(r => r.memberId))].length,
      uniqueFamilyMembers: [...new Set(registrations.filter(r => r.familyMemberId).map(r => r.familyMemberId))].length,
    }

    return {
      summary,
      registrations,
      generatedAt: new Date().toISOString(),
      filters
    }
  }

  async getAttendanceReport(
    userOrgId: number,
    userRole: UserRole,
    filters: ReportFiltersDto
  ) {
    if (!([UserRole.ORG_ADMIN, UserRole.EVENT_STAFF] as UserRole[]).includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions to view reports')
    }

    const whereClause: any = {
      orgId: userOrgId,
      status: RegStatus.CONFIRMED, // Only confirmed registrations count for attendance
    }

    if (filters.eventId) {
      whereClause.eventId = filters.eventId
    }

    if (filters.startDate || filters.endDate) {
      whereClause.event = {}
      if (filters.startDate || filters.endDate) {
        whereClause.event.startsAt = {}
        if (filters.startDate) {
          whereClause.event.startsAt.gte = new Date(filters.startDate)
        }
        if (filters.endDate) {
          whereClause.event.startsAt.lte = new Date(filters.endDate)
        }
      }
    }

    const attendanceData = await this.prisma.registration.findMany({
      where: whereClause,
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            capacity: true,
          }
        },
        member: {
          select: {
            firstName: true,
            lastName: true,
            membershipCategory: true,
          }
        },
        familyMember: {
          select: {
            firstName: true,
            lastName: true,
            relationship: true,
          }
        }
      },
      orderBy: {
        event: { startsAt: 'desc' }
      }
    })

    // Group by event for attendance rates
    const eventAttendance = attendanceData.reduce((acc, reg) => {
      const eventId = reg.eventId
      if (!acc[eventId]) {
        acc[eventId] = {
          event: reg.event,
          totalRegistered: 0,
          totalCheckedIn: 0,
          registrations: []
        }
      }
      acc[eventId].totalRegistered++
      if (reg.checkedIn) {
        acc[eventId].totalCheckedIn++
      }
      acc[eventId].registrations.push(reg)
      return acc
    }, {} as any)

    // Calculate attendance rates
    const eventsWithAttendanceRates = Object.values(eventAttendance).map((event: any) => ({
      ...event,
      attendanceRate: event.totalRegistered > 0 
        ? Math.round((event.totalCheckedIn / event.totalRegistered) * 100)
        : 0
    }))

    const summary = {
      totalEvents: Object.keys(eventAttendance).length,
      totalRegistrations: attendanceData.length,
      totalCheckedIn: attendanceData.filter(r => r.checkedIn).length,
      overallAttendanceRate: attendanceData.length > 0 
        ? Math.round((attendanceData.filter(r => r.checkedIn).length / attendanceData.length) * 100)
        : 0,
      averageEventAttendanceRate: eventsWithAttendanceRates.length > 0
        ? Math.round(eventsWithAttendanceRates.reduce((sum, e) => sum + e.attendanceRate, 0) / eventsWithAttendanceRates.length)
        : 0
    }

    return {
      summary,
      eventAttendance: eventsWithAttendanceRates,
      generatedAt: new Date().toISOString(),
      filters
    }
  }

  async getFinancialReport(
    userOrgId: number,
    userRole: UserRole,
    filters: ReportFiltersDto
  ) {
    // Only ORG_ADMIN can view financial reports
    if (userRole !== UserRole.ORG_ADMIN) {
      throw new ForbiddenException('Only organization admins can view financial reports')
    }

    const whereClause: any = {
      orgId: userOrgId,
    }

    if (!filters.includeInactive) {
      whereClause.isActive = true
    }

    if (filters.membershipCategory) {
      whereClause.membershipCategory = filters.membershipCategory
    }

    const members = await this.prisma.memberProfile.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        membershipCategory: true,
        membershipFee: true,
        lastPaymentDate: true,
        nextPaymentDue: true,
        membershipStartDate: true,
        membershipEndDate: true,
        isActive: true,
      },
      orderBy: [
        { nextPaymentDue: 'asc' },
        { lastName: 'asc' }
      ]
    })

    const now = new Date()
    const overdue = members.filter(m => 
      m.nextPaymentDue && m.nextPaymentDue < now && m.isActive
    )

    const dueSoon = members.filter(m => 
      m.nextPaymentDue && 
      m.nextPaymentDue >= now && 
      m.nextPaymentDue <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && // 30 days
      m.isActive
    )

    const totalAnnualRevenue = members
      .filter(m => m.isActive && m.membershipCategory !== MembershipCategory.LIFE)
      .reduce((sum, m) => sum + Number(m.membershipFee || 0), 0)

    const lifetimeMemberships = members.filter(m => 
      m.membershipCategory === MembershipCategory.LIFE
    )

    const summary = {
      totalActiveMembers: members.filter(m => m.isActive).length,
      totalAnnualRevenue,
      lifetimeMembershipRevenue: lifetimeMemberships.reduce((sum, m) => sum + Number(m.membershipFee || 0), 0),
      overduePayments: {
        count: overdue.length,
        totalAmount: overdue.reduce((sum, m) => sum + Number(m.membershipFee || 0), 0)
      },
      paymentsDueSoon: {
        count: dueSoon.length,
        totalAmount: dueSoon.reduce((sum, m) => sum + Number(m.membershipFee || 0), 0)
      },
      revenueByCategory: this.getRevenueByCategory(members)
    }

    return {
      summary,
      overduePayments: overdue,
      paymentsDueSoon: dueSoon,
      allMembers: members,
      generatedAt: new Date().toISOString(),
      filters
    }
  }

  async exportToCsv(reportType: string, data: any): Promise<string> {
    let csvContent = ''
    
    switch (reportType) {
      case 'membership':
        csvContent = this.membershipToCsv(data.members)
        break
      case 'registrations':
        csvContent = this.registrationsToCsv(data.registrations)
        break
      case 'attendance':
        csvContent = this.attendanceToCsv(data.eventAttendance)
        break
      case 'financial':
        csvContent = this.financialToCsv(data.allMembers)
        break
      default:
        throw new Error('Invalid report type for CSV export')
    }

    return csvContent
  }

  private getMembershipCategoryBreakdown(members: any[]) {
    return Object.values(MembershipCategory).reduce((acc, category) => {
      acc[category] = members.filter(m => m.membershipCategory === category).length
      return acc
    }, {} as Record<string, number>)
  }

  private getPaymentStatusBreakdown(members: any[]) {
    const now = new Date()
    return {
      current: members.filter(m => !m.nextPaymentDue || m.nextPaymentDue > now).length,
      overdue: members.filter(m => m.nextPaymentDue && m.nextPaymentDue < now).length,
      dueSoon: members.filter(m => 
        m.nextPaymentDue && 
        m.nextPaymentDue >= now && 
        m.nextPaymentDue <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      ).length,
    }
  }

  private getRevenueByCategory(members: any[]) {
    return Object.values(MembershipCategory).reduce((acc, category) => {
      const categoryMembers = members.filter(m => m.membershipCategory === category && m.isActive)
      acc[category] = categoryMembers.reduce((sum, m) => sum + Number(m.membershipFee || 0), 0)
      return acc
    }, {} as Record<string, number>)
  }

  private membershipToCsv(members: any[]): string {
    const headers = [
      'ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Membership Category',
      'Membership Fee', 'Start Date', 'Next Payment Due', 'Last Payment Date',
      'Active', 'User Role', 'Family Members Count'
    ]

    const rows = members.map(member => [
      member.id,
      member.firstName,
      member.lastName,
      member.user?.email || '',
      member.phone || '',
      member.membershipCategory,
      member.membershipFee || 0,
      member.membershipStartDate || '',
      member.nextPaymentDue || '',
      member.lastPaymentDate || '',
      member.isActive ? 'Yes' : 'No',
      member.user?.role || '',
      member.family?.length || 0
    ])

    return [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
  }

  private registrationsToCsv(registrations: any[]): string {
    const headers = [
      'Registration ID', 'Event Title', 'Event Date', 'Registrant Name', 'Type',
      'Status', 'Checked In', 'Registered At', 'Custom Data', 'Notes'
    ]

    const rows = registrations.map(reg => [
      reg.id,
      reg.event?.title || '',
      reg.event?.startsAt || '',
      reg.member ? `${reg.member.firstName} ${reg.member.lastName}` : 
                  `${reg.familyMember.firstName} ${reg.familyMember.lastName}`,
      reg.member ? 'Member' : 'Family',
      reg.status,
      reg.checkedIn ? 'Yes' : 'No',
      reg.registeredAt,
      JSON.stringify(reg.customData || {}),
      reg.notes || ''
    ])

    return [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
  }

  private attendanceToCsv(eventAttendance: any[]): string {
    const headers = [
      'Event ID', 'Event Title', 'Event Date', 'Total Registered', 
      'Total Checked In', 'Attendance Rate (%)', 'Capacity'
    ]

    const rows = eventAttendance.map(event => [
      event.event.id,
      event.event.title,
      event.event.startsAt,
      event.totalRegistered,
      event.totalCheckedIn,
      event.attendanceRate,
      event.event.capacity
    ])

    return [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
  }

  private financialToCsv(members: any[]): string {
    const headers = [
      'ID', 'Name', 'Membership Category', 'Membership Fee', 
      'Last Payment Date', 'Next Payment Due', 'Status', 'Active'
    ]

    const rows = members.map(member => [
      member.id,
      `${member.firstName} ${member.lastName}`,
      member.membershipCategory,
      member.membershipFee || 0,
      member.lastPaymentDate || '',
      member.nextPaymentDue || '',
      this.getPaymentStatus(member),
      member.isActive ? 'Yes' : 'No'
    ])

    return [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
  }

  private getPaymentStatus(member: any): string {
    if (!member.nextPaymentDue) return 'No payment required'
    
    const now = new Date()
    const dueDate = new Date(member.nextPaymentDue)
    
    if (dueDate < now) return 'Overdue'
    if (dueDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) return 'Due soon'
    return 'Current'
  }
}