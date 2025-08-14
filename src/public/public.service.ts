import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../config/prisma.service'
import { EmailService } from '../email/email.service'
import { RegisterRequestDto } from './dto/register-request.dto'

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService
  ) {}

  /**
   * Submit a membership registration request
   */
  async submitRegistrationRequest(dto: RegisterRequestDto) {
    const { orgId, orgWebUrl, email, firstName, lastName, phone, zipCode, requestMessage } = dto

    // Find organization by ID or webUrl
    let organization
    if (orgId) {
      organization = await this.prisma.organization.findUnique({
        where: { id: orgId, isActive: true }
      })
    } else if (orgWebUrl) {
      organization = await this.prisma.organization.findUnique({
        where: { webUrl: orgWebUrl, isActive: true }
      })
    } else {
      throw new BadRequestException('Either orgId or orgWebUrl must be provided')
    }

    if (!organization) {
      throw new NotFoundException('Organization not found or inactive')
    }

    // Check if email already exists in this organization
    const existingUser = await this.prisma.userAccount.findUnique({
      where: { 
        orgId_email: { orgId: organization.id, email }
      },
      include: { memberProfile: true }
    })

    if (existingUser) {
      if (existingUser.memberProfile) {
        const status = existingUser.memberProfile.membershipStatus
        if (status === 'ACTIVE') {
          throw new BadRequestException('You are already an active member of this organization')
        }
        if (status === 'PENDING_APPROVAL') {
          throw new BadRequestException('You have already submitted a registration request for this organization')
        }
        if (status === 'INVITED') {
          throw new BadRequestException('You have already been invited to this organization. Please check your email.')
        }
        if (status === 'INACTIVE') {
          throw new BadRequestException('Your membership was previously deactivated. Please contact an administrator.')
        }
      }
    }

    // Create registration request in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      let user = existingUser

      // Create user if doesn't exist
      if (!user) {
        user = await tx.userAccount.create({
          data: {
            orgId: organization.id,
            email,
            role: 'MEMBER',
            isEmailVerified: false,
            isActive: false // Inactive until approved
          }
        })
      }

      // Create member profile with PENDING_APPROVAL status
      const member = await tx.memberProfile.create({
        data: {
          orgId: organization.id,
          userId: user.id,
          firstName,
          lastName,
          phone: phone || null,
          zipCode: zipCode || null,
          membershipStatus: 'PENDING_APPROVAL',
          registrationRequestedAt: new Date(),
          registrationMessage: requestMessage,
          isActive: false // Legacy field
        }
      })

      // Create audit log
      await tx.auditLog.create({
        data: {
          orgId: organization.id,
          actorUserId: user.id,
          action: 'REGISTRATION_REQUESTED',
          targetType: 'Member',
          targetId: member.id,
          payload: {
            email,
            firstName,
            lastName,
            phone: phone || null,
            zipCode: zipCode || null,
            requestMessage: requestMessage || null,
            organizationName: organization.name
          }
        }
      })

      return { user, member, organization }
    })

    // Send notification email to organization admins
    await this.notifyAdminsOfNewRequest(result.organization, result.member, result.user)

    // Send confirmation email to applicant
    await this.emailService.sendRegistrationRequestConfirmation({
      to: email,
      firstName,
      organizationName: organization.name,
      requestId: result.member.id
    })

    return {
      success: true,
      message: 'Registration request submitted successfully',
      requestId: result.member.id,
      organizationName: organization.name,
      status: 'PENDING_APPROVAL'
    }
  }

  /**
   * Get organization info for public display
   */
  async getOrganizationInfo(identifier: string) {
    let organization

    // Try to find by ID first (if numeric), then by webUrl
    if (!isNaN(Number(identifier))) {
      organization = await this.prisma.organization.findUnique({
        where: { id: parseInt(identifier), isActive: true },
        select: {
          id: true,
          name: true,
          webUrl: true,
          // Don't expose sensitive settings
        }
      })
    }

    if (!organization) {
      organization = await this.prisma.organization.findUnique({
        where: { webUrl: identifier, isActive: true },
        select: {
          id: true,
          name: true,
          webUrl: true,
        }
      })
    }

    if (!organization) {
      throw new NotFoundException('Organization not found')
    }

    return organization
  }

  /**
   * Notify organization admins of new registration request
   */
  private async notifyAdminsOfNewRequest(organization: any, member: any, user: any) {
    // Find all admin users in the organization
    const admins = await this.prisma.userAccount.findMany({
      where: {
        orgId: organization.id,
        role: 'ORG_ADMIN',
        isActive: true
      }
    })

    // Send notification email to each admin
    for (const admin of admins) {
      await this.emailService.sendNewRegistrationNotification({
        to: admin.email,
        organizationName: organization.name,
        applicantName: `${member.firstName} ${member.lastName}`,
        applicantEmail: user.email,
        requestMessage: member.registrationMessage,
        memberId: member.id
      })
    }
  }
}