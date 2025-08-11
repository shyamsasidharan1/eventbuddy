import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../config/prisma.service'
import { CreateRegistrationDto, RegistrantType } from './dto/create-registration.dto'
import { UpdateRegistrationDto } from './dto/update-registration.dto'
import { CheckinDto } from './dto/checkin.dto'
import { UserRole, RegStatus } from '@prisma/client'

@Injectable()
export class RegistrationsService {
  constructor(private prisma: PrismaService) {}

  async registerForEvent(
    eventId: string, 
    createRegistrationDto: CreateRegistrationDto,
    userOrgId: number,
    userId: number,
    userRole: UserRole
  ) {
    const eventIdNum = parseInt(eventId)
    
    // Get event details and verify it exists
    const event = await this.prisma.event.findUnique({
      where: {
        id: eventIdNum,
        orgId: userOrgId,
      },
      include: {
        _count: {
          select: {
            registrations: {
              where: {
                status: { in: [RegStatus.CONFIRMED, RegStatus.PENDING] }
              }
            }
          }
        }
      }
    })

    if (!event) {
      throw new NotFoundException('Event not found')
    }

    if (!event.isActive) {
      throw new BadRequestException('Event is not active')
    }

    if (event.startsAt < new Date()) {
      throw new BadRequestException('Cannot register for past events')
    }

    // Check if user has permission to register these people
    await this.validateRegistrationPermissions(
      createRegistrationDto.registrants, 
      userOrgId, 
      userId, 
      userRole
    )

    // Check for existing registrations
    await this.checkExistingRegistrations(eventIdNum, createRegistrationDto.registrants)

    // Check capacity constraints
    const currentRegistrations = event._count.registrations
    const requestedRegistrations = createRegistrationDto.registrants.length
    const totalAfterRegistration = currentRegistrations + requestedRegistrations

    let status: RegStatus = RegStatus.PENDING
    if (event.requiresApproval) {
      status = RegStatus.PENDING
    } else if (totalAfterRegistration <= event.capacity) {
      status = RegStatus.CONFIRMED
    } else if (event.waitlistEnabled && event.maxCapacity && totalAfterRegistration <= event.maxCapacity) {
      status = RegStatus.WAITLISTED
    } else {
      throw new BadRequestException('Event is at capacity and waitlist is full')
    }

    try {
      // Create all registrations
      const registrations = await this.prisma.$transaction(
        createRegistrationDto.registrants.map(registrant => 
          this.prisma.registration.create({
            data: {
              eventId: eventIdNum,
              orgId: userOrgId,
              memberId: registrant.type === RegistrantType.MEMBER ? registrant.id : null,
              familyMemberId: registrant.type === RegistrantType.FAMILY ? registrant.id : null,
              status,
              customData: registrant.customData || {},
              notes: registrant.notes || '',
              registeredAt: new Date(),
            },
            include: {
              member: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                }
              },
              familyMember: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                }
              }
            }
          })
        )
      )

      return {
        message: `Successfully registered ${registrations.length} people for ${event.title}`,
        registrations,
        status,
        eventTitle: event.title,
        eventStartsAt: event.startsAt,
      }
    } catch (error) {
      // Handle Prisma errors
      if (error.code === 'P2002') {
        // Unique constraint violation
        throw new BadRequestException('One or more people are already registered for this event')
      }
      if (error.code === 'P2003') {
        // Foreign key constraint violation
        throw new BadRequestException('Invalid member or family member reference')
      }
      if (error.code === 'P2025') {
        // Record not found
        throw new BadRequestException('Member or family member not found')
      }
      // Re-throw other errors
      throw error
    }
  }

  async getEventRegistrations(
    eventId: string,
    userOrgId: number,
    userRole: UserRole
  ) {
    // Only admins and event staff can view all registrations
    if (!([UserRole.ORG_ADMIN, UserRole.EVENT_STAFF] as UserRole[]).includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions to view event registrations')
    }

    const event = await this.prisma.event.findUnique({
      where: {
        id: parseInt(eventId),
        orgId: userOrgId,
      }
    })

    if (!event) {
      throw new NotFoundException('Event not found')
    }

    const registrations = await this.prisma.registration.findMany({
      where: {
        eventId: parseInt(eventId),
        orgId: userOrgId,
      },
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
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
            phone: true,
            email: true,
          }
        },
        checkedInBy: {
          select: {
            id: true,
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
        { status: 'asc' },
        { registeredAt: 'asc' }
      ]
    })

    // Group by status for easy summary
    const summary = {
      total: registrations.length,
      confirmed: registrations.filter(r => r.status === RegStatus.CONFIRMED).length,
      pending: registrations.filter(r => r.status === RegStatus.PENDING).length,
      waitlisted: registrations.filter(r => r.status === RegStatus.WAITLISTED).length,
      cancelled: registrations.filter(r => r.status === RegStatus.CANCELLED).length,
      checkedIn: registrations.filter(r => r.checkedIn).length,
    }

    return {
      eventTitle: event.title,
      eventStartsAt: event.startsAt,
      capacity: event.capacity,
      maxCapacity: event.maxCapacity,
      summary,
      registrations,
    }
  }

  async getUserRegistrations(
    userOrgId: number,
    userId: number
  ) {
    // Get user's member profile
    const memberProfile = await this.prisma.memberProfile.findUnique({
      where: { userId },
      include: {
        family: {
          where: { isActive: true },
          select: { id: true }
        }
      }
    })

    if (!memberProfile) {
      return { registrations: [] }
    }

    // Get registrations for the member and their family
    const familyIds = memberProfile.family.map(f => f.id)
    
    const registrations = await this.prisma.registration.findMany({
      where: {
        orgId: userOrgId,
        OR: [
          { memberId: memberProfile.id },
          { familyMemberId: { in: familyIds } }
        ]
      },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            endsAt: true,
            location: true,
          }
        },
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        },
        familyMember: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          }
        }
      },
      orderBy: {
        registeredAt: 'desc'
      }
    })

    return { registrations }
  }

  async updateRegistration(
    registrationId: string,
    updateRegistrationDto: UpdateRegistrationDto,
    userOrgId: number,
    userRole: UserRole
  ) {
    // Only admins can update registrations
    if (userRole !== UserRole.ORG_ADMIN) {
      throw new ForbiddenException('Only organization admins can update registrations')
    }

    const registration = await this.prisma.registration.findUnique({
      where: {
        id: parseInt(registrationId),
        orgId: userOrgId,
      },
      include: {
        event: {
          select: {
            title: true,
            capacity: true,
            maxCapacity: true,
          }
        }
      }
    })

    if (!registration) {
      throw new NotFoundException('Registration not found')
    }

    // If changing to CONFIRMED, check capacity
    if (updateRegistrationDto.status === RegStatus.CONFIRMED && 
        registration.status !== RegStatus.CONFIRMED) {
      
      const confirmedCount = await this.prisma.registration.count({
        where: {
          eventId: registration.eventId,
          status: RegStatus.CONFIRMED,
        }
      })

      if (confirmedCount >= registration.event.capacity) {
        throw new BadRequestException('Event is at capacity')
      }
    }

    const updatedRegistration = await this.prisma.registration.update({
      where: { id: parseInt(registrationId) },
      data: updateRegistrationDto,
      include: {
        member: {
          select: {
            firstName: true,
            lastName: true,
          }
        },
        familyMember: {
          select: {
            firstName: true,
            lastName: true,
          }
        },
        event: {
          select: {
            title: true,
          }
        }
      }
    })

    return updatedRegistration
  }

  async checkinAttendees(
    eventId: string,
    checkinDto: CheckinDto,
    userOrgId: number,
    staffUserId: number,
    userRole: UserRole
  ) {
    // Only admins and event staff can check people in
    if (!([UserRole.ORG_ADMIN, UserRole.EVENT_STAFF] as UserRole[]).includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions to check in attendees')
    }

    // Verify all registrations exist and belong to this event
    const registrations = await this.prisma.registration.findMany({
      where: {
        id: { in: checkinDto.registrationIds },
        eventId: parseInt(eventId),
        orgId: userOrgId,
        status: RegStatus.CONFIRMED, // Only confirmed registrations can be checked in
      }
    })

    if (registrations.length !== checkinDto.registrationIds.length) {
      throw new BadRequestException('Some registrations not found or not confirmed')
    }

    // Check in all registrations
    const checkedInRegistrations = await this.prisma.$transaction(
      checkinDto.registrationIds.map(id =>
        this.prisma.registration.update({
          where: { id },
          data: {
            checkedIn: true,
            checkedInAt: new Date(),
            checkedInById: staffUserId,
          },
          include: {
            member: {
              select: {
                firstName: true,
                lastName: true,
              }
            },
            familyMember: {
              select: {
                firstName: true,
                lastName: true,
              }
            }
          }
        })
      )
    )

    return {
      message: `Successfully checked in ${checkedInRegistrations.length} attendees`,
      checkedInRegistrations,
    }
  }

  private async validateRegistrationPermissions(
    registrants: any[],
    userOrgId: number,
    userId: number,
    userRole: UserRole
  ) {
    // Admins can register anyone
    if (userRole === UserRole.ORG_ADMIN) {
      return
    }

    // Get user's member profile
    const memberProfile = await this.prisma.memberProfile.findUnique({
      where: { userId },
      include: {
        family: {
          where: { isActive: true },
          select: { id: true }
        }
      }
    })

    if (!memberProfile) {
      throw new ForbiddenException('No member profile found')
    }

    const familyIds = memberProfile.family.map(f => f.id)

    // Check each registrant
    for (const registrant of registrants) {
      if (registrant.type === RegistrantType.MEMBER) {
        // Can only register self
        if (registrant.id !== memberProfile.id) {
          throw new ForbiddenException('Can only register yourself and your family members')
        }
      } else if (registrant.type === RegistrantType.FAMILY) {
        // Can only register own family members
        if (!familyIds.includes(registrant.id)) {
          throw new ForbiddenException('Can only register your own family members')
        }
      }
    }
  }

  private async checkExistingRegistrations(eventId: number, registrants: any[]) {
    const memberIds = registrants
      .filter(r => r.type === RegistrantType.MEMBER)
      .map(r => r.id)
    
    const familyIds = registrants
      .filter(r => r.type === RegistrantType.FAMILY)
      .map(r => r.id)

    const existingRegistrations = await this.prisma.registration.findMany({
      where: {
        eventId,
        OR: [
          { memberId: { in: memberIds } },
          { familyMemberId: { in: familyIds } }
        ]
      },
      include: {
        member: {
          select: { firstName: true, lastName: true }
        },
        familyMember: {
          select: { firstName: true, lastName: true }
        }
      }
    })

    if (existingRegistrations.length > 0) {
      const names = existingRegistrations.map(reg => 
        reg.member ? 
          `${reg.member.firstName} ${reg.member.lastName}` : 
          `${reg.familyMember.firstName} ${reg.familyMember.lastName}`
      ).join(', ')
      
      throw new BadRequestException(`Some people are already registered: ${names}`)
    }
  }
}