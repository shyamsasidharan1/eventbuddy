import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../config/prisma.service'
import { UpdateMemberDto } from './dto/update-member.dto'
import { UserRole } from '@prisma/client'

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async findAll(userOrgId: number, userRole: UserRole) {
    // Only ORG_ADMIN and EVENT_STAFF can view all members
    if (!([UserRole.ORG_ADMIN, UserRole.EVENT_STAFF] as UserRole[]).includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions to view members')
    }

    return this.prisma.memberProfile.findMany({
      where: {
        orgId: userOrgId,
        isActive: true,
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
      orderBy: {
        lastName: 'asc',
      },
    })
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

    return this.prisma.memberProfile.update({
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

    const [totalMembers, activeMembers, totalFamilyMembers] = await Promise.all([
      this.prisma.memberProfile.count({
        where: { orgId: userOrgId },
      }),
      this.prisma.memberProfile.count({
        where: { orgId: userOrgId, isActive: true },
      }),
      this.prisma.familyMember.count({
        where: { orgId: userOrgId, isActive: true },
      }),
    ])

    return {
      totalMembers,
      activeMembers,
      inactiveMembers: totalMembers - activeMembers,
      totalFamilyMembers,
      totalPeople: activeMembers + totalFamilyMembers,
    }
  }
}