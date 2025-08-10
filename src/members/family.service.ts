import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../config/prisma.service'
import { CreateFamilyMemberDto } from './dto/create-family-member.dto'
import { UserRole } from '@prisma/client'

@Injectable()
export class FamilyService {
  constructor(private prisma: PrismaService) {}

  async create(
    memberId: string,
    createFamilyMemberDto: CreateFamilyMemberDto,
    userOrgId: number,
    userId: string,
    userRole: UserRole,
  ) {
    // Verify the member exists and user has permission
    const member = await this.prisma.memberProfile.findUnique({
      where: {
        id: parseInt(memberId),
        orgId: userOrgId,
      },
    })

    if (!member) {
      throw new NotFoundException('Member not found')
    }

    // Members can only add family to their own profile unless admin
    if (userRole === UserRole.MEMBER && member.userId.toString() !== userId) {
      throw new ForbiddenException('Cannot add family members to other profiles')
    }

    return this.prisma.familyMember.create({
      data: {
        ...createFamilyMemberDto,
        dateOfBirth: new Date(createFamilyMemberDto.dateOfBirth),
        memberId: parseInt(memberId),
        orgId: userOrgId,
        isActive: true,
      },
    })
  }

  async findByMember(
    memberId: string,
    userOrgId: number,
    userId: string,
    userRole: UserRole,
  ) {
    // Verify the member exists and user has permission
    const member = await this.prisma.memberProfile.findUnique({
      where: {
        id: parseInt(memberId),
        orgId: userOrgId,
      },
    })

    if (!member) {
      throw new NotFoundException('Member not found')
    }

    // Members can only view family from their own profile unless admin/staff
    if (userRole === UserRole.MEMBER && member.userId.toString() !== userId) {
      throw new ForbiddenException('Cannot access other member family data')
    }

    return this.prisma.familyMember.findMany({
      where: {
        memberId: parseInt(memberId),
        orgId: userOrgId,
        isActive: true,
      },
      orderBy: {
        firstName: 'asc',
      },
    })
  }

  async update(
    id: string,
    updateData: Partial<CreateFamilyMemberDto>,
    userOrgId: number,
    userId: string,
    userRole: UserRole,
  ) {
    const familyMember = await this.prisma.familyMember.findUnique({
      where: {
        id: parseInt(id),
        orgId: userOrgId,
      },
      include: {
        member: true,
      },
    })

    if (!familyMember) {
      throw new NotFoundException('Family member not found')
    }

    // Members can only update family in their own profile unless admin
    if (userRole === UserRole.MEMBER && familyMember.member.userId.toString() !== userId) {
      throw new ForbiddenException('Cannot update family members from other profiles')
    }

    return this.prisma.familyMember.update({
      where: {
        id: parseInt(id),
        orgId: userOrgId,
      },
      data: {
        ...updateData,
        dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined,
        updatedAt: new Date(),
      },
    })
  }

  async remove(
    id: string,
    userOrgId: number,
    userId: string,
    userRole: UserRole,
  ) {
    const familyMember = await this.prisma.familyMember.findUnique({
      where: {
        id: parseInt(id),
        orgId: userOrgId,
      },
      include: {
        member: true,
      },
    })

    if (!familyMember) {
      throw new NotFoundException('Family member not found')
    }

    // Members can only remove family from their own profile unless admin
    if (userRole === UserRole.MEMBER && familyMember.member.userId.toString() !== userId) {
      throw new ForbiddenException('Cannot remove family members from other profiles')
    }

    // Soft delete by setting isActive to false
    await this.prisma.familyMember.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    })

    return { message: 'Family member removed successfully' }
  }
}