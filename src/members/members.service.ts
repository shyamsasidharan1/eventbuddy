import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../config/prisma.service'
import { UpdateMemberDto } from './dto/update-member.dto'
import { UserRole, MembershipStatus } from '@prisma/client'
import { InvitesService } from '../invites/invites.service'
import { EmailService } from '../email/email.service'

interface FindAllParams {
  orgId: number
  role: UserRole
  status?: MembershipStatus
  query?: string
  page?: number
  pageSize?: number
}

interface InviteParams {
  orgId: number
  invitedByUserId: number
  email: string
  firstName?: string
  lastName?: string
}

interface InactivateParams {
  id: number
  orgId: number
  reason: string
  actorId: number
}

interface ActivateParams {
  id: number
  orgId: number
  actorId: number
}

interface ApproveRegistrationParams {
  memberId: number
  orgId: number
  approve: boolean
  message?: string
  denialReason?: string
  actorId: number
}

interface PendingApprovalsParams {
  orgId: number
  page?: number
  pageSize?: number
}

@Injectable()
export class MembersService {
  constructor(
    private prisma: PrismaService,
    private invitesService: InvitesService,
    private emailService: EmailService
  ) {}

  async findAll(params: FindAllParams) {
    const { orgId, role, status, query, page = 1, pageSize = 50 } = params

    // Only ORG_ADMIN and EVENT_STAFF can view all members
    if (!([UserRole.ORG_ADMIN, UserRole.EVENT_STAFF] as UserRole[]).includes(role)) {
      throw new ForbiddenException('Insufficient permissions to view members')
    }

    // Build where clause
    const where: any = {
      orgId,
    }

    // Status filtering - default to exclude INACTIVE unless explicitly requested
    if (status) {
      where.membershipStatus = status
    } else {
      where.membershipStatus = {
        not: 'INACTIVE'
      }
    }

    // Search query
    if (query) {
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { user: { email: { contains: query, mode: 'insensitive' } } }
      ]
    }

    // Calculate pagination
    const skip = (page - 1) * pageSize

    const [members, total] = await Promise.all([
      this.prisma.memberProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
          family: {
            where: { isActive: true },
          },
        },
        orderBy: [
          // Prioritize pending approvals for admin attention
          { membershipStatus: 'asc' }, // PENDING_APPROVAL comes first alphabetically
          { registrationRequestedAt: 'desc' }, // Most recent requests first within same status
          { lastName: 'asc' },
          { firstName: 'asc' }
        ],
        skip,
        take: pageSize,
      }),
      this.prisma.memberProfile.count({ where })
    ])

    return {
      data: members,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  }

  async findOne(id: string, userOrgId: number, userId: string, userRole: UserRole) {
    const member = await this.prisma.memberProfile.findUnique({
      where: {
        id: parseInt(id),
        orgId: userOrgId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        family: {
          where: { isActive: true },
        },
      },
    })

    if (!member) {
      throw new NotFoundException('Member not found')
    }

    // Members can only view their own profile unless admin/staff
    if (userRole === UserRole.MEMBER && member.userId.toString() !== userId) {
      throw new ForbiddenException('Cannot access other member profiles')
    }

    return member
  }

  async update(id: string, updateMemberDto: UpdateMemberDto, userOrgId: number, userId: string, userRole: UserRole) {
    const member = await this.findOne(id, userOrgId, userId, userRole)

    // Members can only update their own profile unless admin
    if (userRole === UserRole.MEMBER && member.userId.toString() !== userId) {
      throw new ForbiddenException('Cannot update other member profiles')
    }

    try {
      return await this.prisma.memberProfile.update({
        where: {
          id: parseInt(id),
          orgId: userOrgId,
        },
        data: {
          ...updateMemberDto,
          dateOfBirth: updateMemberDto.dateOfBirth ? new Date(updateMemberDto.dateOfBirth) : undefined,
          updatedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
          family: {
            where: { isActive: true },
          },
        },
      })
    } catch (error) {
      // Handle Prisma errors
      if (error.code === 'P2025') {
        // Record not found
        throw new NotFoundException('Member not found')
      }
      if (error.code === 'P2002') {
        // Unique constraint violation
        throw new BadRequestException('Member with these details already exists')
      }
      // Re-throw other errors
      throw error
    }
  }

  async deactivate(id: string, userOrgId: number, userRole: UserRole) {
    // Only ORG_ADMIN can deactivate members
    if (userRole !== UserRole.ORG_ADMIN) {
      throw new ForbiddenException('Only organization admins can deactivate members')
    }

    const member = await this.prisma.memberProfile.findUnique({
      where: {
        id: parseInt(id),
        orgId: userOrgId,
      },
    })

    if (!member) {
      throw new NotFoundException('Member not found')
    }

    // Update both member profile and user account
    await this.prisma.$transaction([
      this.prisma.memberProfile.update({
        where: { id: parseInt(id) },
        data: { isActive: false },
      }),
      this.prisma.userAccount.update({
        where: { id: member.userId },
        data: { isActive: false },
      }),
    ])

    return { message: 'Member deactivated successfully' }
  }

  async getMemberStats(userOrgId: number, userRole: UserRole) {
    if (!([UserRole.ORG_ADMIN, UserRole.EVENT_STAFF] as UserRole[]).includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions to view member statistics')
    }

    const [
      totalMembers,
      pendingApprovalMembers,
      invitedMembers,
      activeMembers,
      inactiveMembers,
      totalFamilyMembers
    ] = await Promise.all([
      this.prisma.memberProfile.count({
        where: { orgId: userOrgId },
      }),
      this.prisma.memberProfile.count({
        where: { orgId: userOrgId, membershipStatus: 'PENDING_APPROVAL' },
      }),
      this.prisma.memberProfile.count({
        where: { orgId: userOrgId, membershipStatus: 'INVITED' },
      }),
      this.prisma.memberProfile.count({
        where: { orgId: userOrgId, membershipStatus: 'ACTIVE' },
      }),
      this.prisma.memberProfile.count({
        where: { orgId: userOrgId, membershipStatus: 'INACTIVE' },
      }),
      this.prisma.familyMember.count({
        where: { orgId: userOrgId, isActive: true },
      }),
    ])

    return {
      totalMembers,
      pendingApprovalMembers,
      invitedMembers,
      activeMembers,
      inactiveMembers,
      totalFamilyMembers,
      totalPeople: activeMembers + totalFamilyMembers,
    }
  }

  /**
   * Get members with pending approval status for admin review
   */
  async getPendingApprovals(params: PendingApprovalsParams) {
    const { orgId, page = 1, pageSize = 20 } = params

    const skip = (page - 1) * pageSize

    const where = {
      orgId,
      membershipStatus: 'PENDING_APPROVAL' as const
    }

    const [members, total] = await Promise.all([
      this.prisma.memberProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              createdAt: true,
            },
          },
        },
        orderBy: [
          { registrationRequestedAt: 'desc' }, // Most recent first
        ],
        skip,
        take: pageSize,
      }),
      this.prisma.memberProfile.count({ where })
    ])

    return {
      data: members,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  }

  /**
   * Invite a new member to the organization
   */
  async invite(params: InviteParams) {
    const { orgId, invitedByUserId, email, firstName, lastName } = params

    // Check if email already exists in this org
    const existingUser = await this.prisma.userAccount.findUnique({
      where: { 
        orgId_email: { orgId, email }
      },
      include: { memberProfile: true }
    })

    if (existingUser && existingUser.memberProfile) {
      if (existingUser.memberProfile.membershipStatus === 'ACTIVE') {
        throw new BadRequestException('Member already exists and is active')
      }
      if (existingUser.memberProfile.membershipStatus === 'INVITED') {
        throw new BadRequestException('Member has already been invited')
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let user = existingUser

      // Create user if doesn't exist
      if (!user) {
        user = await tx.userAccount.create({
          data: {
            orgId,
            email,
            role: 'MEMBER',
            isEmailVerified: false,
            isActive: true
          }
        })
      }

      // Create or update member profile
      let member
      if (user.memberProfile) {
        member = await tx.memberProfile.update({
          where: { id: user.memberProfile.id },
          data: {
            membershipStatus: 'INVITED',
            invitedAt: new Date(),
            firstName: firstName || user.memberProfile.firstName,
            lastName: lastName || user.memberProfile.lastName,
            isActive: false // Legacy field
          }
        })
      } else {
        member = await tx.memberProfile.create({
          data: {
            orgId,
            userId: user.id,
            firstName: firstName || 'Invited',
            lastName: lastName || 'Member',
            membershipStatus: 'INVITED',
            invitedAt: new Date(),
            isActive: false // Legacy field
          }
        })
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          orgId,
          actorUserId: invitedByUserId,
          action: 'INVITE_SENT',
          targetType: 'Member',
          targetId: member.id,
          payload: {
            invitedEmail: email,
            memberId: member.id,
            userId: user.id
          }
        }
      })

      return { user, member }
    })

    // Generate invite token
    const token = await this.invitesService.createInviteToken({
      orgId,
      userId: result.user.id,
      memberId: result.member.id
    })

    // Send invite email
    await this.emailService.sendMemberInvite({
      to: email,
      firstName: firstName || 'New Member',
      token,
      orgId
    })

    return {
      success: true,
      message: 'Member invitation sent successfully',
      member: {
        id: result.member.id,
        email,
        firstName: result.member.firstName,
        lastName: result.member.lastName,
        membershipStatus: result.member.membershipStatus,
        invitedAt: result.member.invitedAt
      }
    }
  }

  /**
   * Inactivate a member with reason
   */
  async inactivate(params: InactivateParams) {
    const { id, orgId, reason, actorId } = params

    const member = await this.prisma.memberProfile.findUnique({
      where: { id, orgId },
      include: { user: true }
    })

    if (!member) {
      throw new NotFoundException('Member not found')
    }

    if (member.membershipStatus === 'INACTIVE') {
      throw new BadRequestException('Member is already inactive')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Update member profile
      const updatedMember = await tx.memberProfile.update({
        where: { id },
        data: {
          membershipStatus: 'INACTIVE',
          inactivatedAt: new Date(),
          inactivatedReason: reason,
          isActive: false // Legacy field
        }
      })

      // Update user account
      await tx.userAccount.update({
        where: { id: member.userId },
        data: { isActive: false }
      })

      // Create audit log
      await tx.auditLog.create({
        data: {
          orgId,
          actorUserId: actorId,
          action: 'UPDATE',
          targetType: 'Member',
          targetId: id,
          payload: {
            action: 'INACTIVATE',
            reason,
            previousStatus: member.membershipStatus,
            newStatus: 'INACTIVE'
          }
        }
      })

      return updatedMember
    })

    return {
      success: true,
      message: 'Member inactivated successfully',
      member: {
        id: result.id,
        membershipStatus: result.membershipStatus,
        inactivatedAt: result.inactivatedAt,
        inactivatedReason: result.inactivatedReason
      }
    }
  }

  /**
   * Activate/reactivate a member
   */
  async activate(params: ActivateParams) {
    const { id, orgId, actorId } = params

    const member = await this.prisma.memberProfile.findUnique({
      where: { id, orgId },
      include: { user: true }
    })

    if (!member) {
      throw new NotFoundException('Member not found')
    }

    if (member.membershipStatus === 'ACTIVE') {
      throw new BadRequestException('Member is already active')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Update member profile
      const updatedMember = await tx.memberProfile.update({
        where: { id },
        data: {
          membershipStatus: 'ACTIVE',
          activatedAt: new Date(),
          inactivatedAt: null,
          inactivatedReason: null,
          isActive: true // Legacy field
        }
      })

      // Update user account
      await tx.userAccount.update({
        where: { id: member.userId },
        data: { isActive: true }
      })

      // Create audit log
      await tx.auditLog.create({
        data: {
          orgId,
          actorUserId: actorId,
          action: 'UPDATE',
          targetType: 'Member',
          targetId: id,
          payload: {
            action: 'ACTIVATE',
            previousStatus: member.membershipStatus,
            newStatus: 'ACTIVE'
          }
        }
      })

      return updatedMember
    })

    return {
      success: true,
      message: 'Member activated successfully',
      member: {
        id: result.id,
        membershipStatus: result.membershipStatus,
        activatedAt: result.activatedAt
      }
    }
  }

  /**
   * Approve or deny a pending registration request
   */
  async approveRegistration(params: ApproveRegistrationParams) {
    const { memberId, orgId, approve, message, denialReason, actorId } = params

    // Find the pending member
    const member = await this.prisma.memberProfile.findUnique({
      where: { id: memberId, orgId },
      include: { 
        user: true,
        organization: true 
      }
    })

    if (!member) {
      throw new NotFoundException('Member not found')
    }

    if (member.membershipStatus !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Member is not pending approval')
    }

    // Validate denial reason for denials
    if (!approve && !denialReason) {
      throw new BadRequestException('Denial reason is required when denying membership')
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let updatedMember

      if (approve) {
        // Approve the member
        updatedMember = await tx.memberProfile.update({
          where: { id: memberId },
          data: {
            membershipStatus: 'ACTIVE',
            approvedAt: new Date(),
            approvedById: actorId,
            activatedAt: new Date(),
            isActive: true // Legacy field
          }
        })

        // Activate user account
        await tx.userAccount.update({
          where: { id: member.userId },
          data: { isActive: true }
        })

        // Create approval audit log
        await tx.auditLog.create({
          data: {
            orgId,
            actorUserId: actorId,
            action: 'MEMBER_APPROVED',
            targetType: 'Member',
            targetId: memberId,
            payload: {
              previousStatus: 'PENDING_APPROVAL',
              newStatus: 'ACTIVE',
              approverMessage: message,
              applicantEmail: member.user.email,
              applicantName: `${member.firstName} ${member.lastName}`
            }
          }
        })
      } else {
        // Deny the member
        updatedMember = await tx.memberProfile.update({
          where: { id: memberId },
          data: {
            membershipStatus: 'INACTIVE',
            deniedAt: new Date(),
            deniedById: actorId,
            denialReason,
            inactivatedAt: new Date(),
            inactivatedReason: `Registration denied: ${denialReason}`,
            isActive: false // Legacy field
          }
        })

        // Keep user account inactive
        await tx.userAccount.update({
          where: { id: member.userId },
          data: { isActive: false }
        })

        // Create denial audit log
        await tx.auditLog.create({
          data: {
            orgId,
            actorUserId: actorId,
            action: 'MEMBER_DENIED',
            targetType: 'Member',
            targetId: memberId,
            payload: {
              previousStatus: 'PENDING_APPROVAL',
              newStatus: 'INACTIVE',
              denialReason,
              denierMessage: message,
              applicantEmail: member.user.email,
              applicantName: `${member.firstName} ${member.lastName}`
            }
          }
        })
      }

      return updatedMember
    })

    // Send notification email to the applicant
    if (approve) {
      await this.emailService.sendRegistrationApproval({
        to: member.user.email,
        firstName: member.firstName,
        organizationName: member.organization.name,
        message: message
      })
    } else {
      await this.emailService.sendRegistrationDenial({
        to: member.user.email,
        firstName: member.firstName,
        organizationName: member.organization.name,
        denialReason: denialReason!,
        message: message
      })
    }

    const actionMessage = approve ? 'Member approved successfully' : 'Member registration denied'

    return {
      success: true,
      message: actionMessage,
      member: {
        id: result.id,
        firstName: result.firstName,
        lastName: result.lastName,
        membershipStatus: result.membershipStatus,
        approvedAt: result.approvedAt,
        deniedAt: result.deniedAt,
        denialReason: result.denialReason
      }
    }
  }
}