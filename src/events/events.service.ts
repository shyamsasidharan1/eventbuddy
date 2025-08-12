import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../config/prisma.service'
import { CreateEventDto } from './dto/create-event.dto'
import { UpdateEventDto } from './dto/update-event.dto'
import { UserRole } from '@prisma/client'

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async create(createEventDto: CreateEventDto, userOrgId: number, userRole: UserRole) {
    // Only ORG_ADMIN can create events
    if (userRole !== UserRole.ORG_ADMIN) {
      throw new ForbiddenException('Only organization admins can create events')
    }

    // Validate dates
    const startsAt = new Date(createEventDto.startsAt)
    const endsAt = createEventDto.endsAt ? new Date(createEventDto.endsAt) : null

    if (startsAt <= new Date()) {
      throw new BadRequestException('Event start date must be in the future')
    }

    if (endsAt && endsAt <= startsAt) {
      throw new BadRequestException('Event end date must be after start date')
    }

    // Validate capacity
    if (createEventDto.maxCapacity && createEventDto.maxCapacity < createEventDto.capacity) {
      throw new BadRequestException('Maximum capacity cannot be less than regular capacity')
    }

    try {
      return await this.prisma.event.create({
        data: {
          ...createEventDto,
          startsAt,
          endsAt,
          orgId: userOrgId,
          waitlistEnabled: createEventDto.waitlistEnabled ?? true,
          requiresApproval: createEventDto.requiresApproval ?? false,
          isPublic: createEventDto.isPublic ?? false,
          customFields: createEventDto.customFields || {},
          isActive: true,
        },
      })
    } catch (error) {
      // Handle Prisma errors
      if (error.code === 'P2002') {
        // Unique constraint violation
        throw new BadRequestException('Event with this title already exists')
      }
      if (error.code === 'P2003') {
        // Foreign key constraint violation
        throw new BadRequestException('Invalid organization reference')
      }
      // Re-throw other errors
      throw error
    }
  }

  async findAll(userOrgId: number, userRole: UserRole, includeInactive = false) {
    const whereClause: any = {
      orgId: userOrgId,
    }

    // Only admins can see inactive events
    if (!includeInactive || userRole === UserRole.MEMBER) {
      whereClause.isActive = true
    }

    return this.prisma.event.findMany({
      where: whereClause,
      include: {
        registrations: {
          select: {
            id: true,
            status: true,
            checkedIn: true,
            memberId: true,
            familyMemberId: true,
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
    })
  }

  async findOne(id: string, userOrgId: number) {
    const event = await this.prisma.event.findUnique({
      where: {
        id: parseInt(id),
        orgId: userOrgId,
      },
      include: {
        registrations: {
          include: {
            member: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            familyMember: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            registrations: true,
          },
        },
      },
    })

    if (!event) {
      throw new NotFoundException('Event not found')
    }

    return event
  }

  async update(id: string, updateEventDto: UpdateEventDto, userOrgId: number, userRole: UserRole) {
    // Only ORG_ADMIN can update events
    if (userRole !== UserRole.ORG_ADMIN) {
      throw new ForbiddenException('Only organization admins can update events')
    }

    const existingEvent = await this.prisma.event.findUnique({
      where: {
        id: parseInt(id),
        orgId: userOrgId,
      },
    })

    if (!existingEvent) {
      throw new NotFoundException('Event not found')
    }

    // Validate dates if provided
    const updateData: any = { ...updateEventDto }
    
    if (updateEventDto.startsAt) {
      updateData.startsAt = new Date(updateEventDto.startsAt)
      if (updateData.startsAt <= new Date()) {
        throw new BadRequestException('Event start date must be in the future')
      }
    }

    if (updateEventDto.endsAt) {
      updateData.endsAt = new Date(updateEventDto.endsAt)
      const startsAt = updateData.startsAt || existingEvent.startsAt
      if (updateData.endsAt <= startsAt) {
        throw new BadRequestException('Event end date must be after start date')
      }
    }

    // Validate capacity
    if (updateEventDto.capacity || updateEventDto.maxCapacity) {
      const newCapacity = updateEventDto.capacity || existingEvent.capacity
      const newMaxCapacity = updateEventDto.maxCapacity || existingEvent.maxCapacity
      
      if (newMaxCapacity && newMaxCapacity < newCapacity) {
        throw new BadRequestException('Maximum capacity cannot be less than regular capacity')
      }
    }

    try {
      return await this.prisma.event.update({
        where: {
          id: parseInt(id),
          orgId: userOrgId,
        },
        data: updateData,
        include: {
          registrations: {
            select: {
              id: true,
              status: true,
              checkedIn: true,
            },
          },
          _count: {
            select: {
              registrations: true,
            },
          },
        },
      })
    } catch (error) {
      // Handle Prisma errors
      if (error.code === 'P2025') {
        // Record not found
        throw new NotFoundException('Event not found')
      }
      if (error.code === 'P2002') {
        // Unique constraint violation
        throw new BadRequestException('Event with this title already exists')
      }
      // Re-throw other errors
      throw error
    }
  }

  async deactivate(id: string, userOrgId: number, userRole: UserRole) {
    // Only ORG_ADMIN can deactivate events
    if (userRole !== UserRole.ORG_ADMIN) {
      throw new ForbiddenException('Only organization admins can deactivate events')
    }

    const event = await this.prisma.event.findUnique({
      where: {
        id: parseInt(id),
        orgId: userOrgId,
      },
    })

    if (!event) {
      throw new NotFoundException('Event not found')
    }

    await this.prisma.event.update({
      where: { id: parseInt(id) },
      data: { isActive: false },
    })

    return { message: 'Event deactivated successfully' }
  }

  async getEventStats(userOrgId: number, userRole: UserRole) {
    if (!([UserRole.ORG_ADMIN, UserRole.EVENT_STAFF] as UserRole[]).includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions to view event statistics')
    }

    const [totalEvents, activeEvents, upcomingEvents, pastEvents] = await Promise.all([
      this.prisma.event.count({
        where: { orgId: userOrgId },
      }),
      this.prisma.event.count({
        where: { orgId: userOrgId, isActive: true },
      }),
      this.prisma.event.count({
        where: {
          orgId: userOrgId,
          isActive: true,
          startsAt: { gt: new Date() },
        },
      }),
      this.prisma.event.count({
        where: {
          orgId: userOrgId,
          startsAt: { lt: new Date() },
        },
      }),
    ])

    return {
      totalEvents,
      activeEvents,
      inactiveEvents: totalEvents - activeEvents,
      upcomingEvents,
      pastEvents,
    }
  }

  async checkCapacity(eventId: string, userOrgId: number) {
    const event = await this.prisma.event.findUnique({
      where: {
        id: parseInt(eventId),
        orgId: userOrgId,
      },
      include: {
        _count: {
          select: {
            registrations: {
              where: {
                status: { in: ['CONFIRMED', 'PENDING'] },
              },
            },
          },
        },
      },
    })

    if (!event) {
      throw new NotFoundException('Event not found')
    }

    const confirmedCount = event._count.registrations
    const availableSpots = event.capacity - confirmedCount
    const canRegister = availableSpots > 0
    const canWaitlist = !canRegister && event.waitlistEnabled && event.maxCapacity 
      ? confirmedCount < event.maxCapacity 
      : false

    return {
      eventId: event.id,
      title: event.title,
      capacity: event.capacity,
      maxCapacity: event.maxCapacity,
      currentRegistrations: confirmedCount,
      availableSpots: Math.max(0, availableSpots),
      canRegister,
      canWaitlist,
      waitlistEnabled: event.waitlistEnabled,
    }
  }
}