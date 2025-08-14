import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../config/prisma.service'
import * as bcrypt from 'bcryptjs'

interface InviteTokenPayload {
  orgId: number
  userId: number
  memberId: number
  email: string
  type: 'member_invite'
  iat?: number
  exp?: number
}

interface CreateInviteTokenParams {
  orgId: number
  userId: number
  memberId: number
  ttlSeconds?: number
}

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Generate an invite token for member activation
   */
  async createInviteToken({
    orgId,
    userId,
    memberId,
    ttlSeconds
  }: CreateInviteTokenParams): Promise<string> {
    const user = await this.prisma.userAccount.findFirst({
      where: { id: userId, orgId },
      include: { memberProfile: true }
    })

    if (!user || !user.memberProfile || user.memberProfile.id !== memberId) {
      throw new BadRequestException('Invalid user or member relationship')
    }

    const ttl = ttlSeconds || this.configService.get<number>('INVITE_TOKEN_TTL', 259200) // 72h default
    
    const payload: InviteTokenPayload = {
      orgId,
      userId,
      memberId,
      email: user.email,
      type: 'member_invite'
    }

    return this.jwtService.sign(payload, {
      expiresIn: `${ttl}s`,
      secret: this.configService.get<string>('JWT_SECRET')
    })
  }

  /**
   * Verify and decode an invite token
   */
  async verifyInviteToken(token: string): Promise<InviteTokenPayload> {
    try {
      const payload = this.jwtService.verify<InviteTokenPayload>(token, {
        secret: this.configService.get<string>('JWT_SECRET')
      })

      if (payload.type !== 'member_invite') {
        throw new UnauthorizedException('Invalid token type')
      }

      return payload
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired invite token')
    }
  }

  /**
   * Accept an invite and activate member account
   */
  async acceptInvite(token: string, password: string): Promise<{
    success: boolean
    userId: number
    memberId: number
  }> {
    const payload = await this.verifyInviteToken(token)

    // Check if user and member still exist and are in INVITED status
    const user = await this.prisma.userAccount.findFirst({
      where: { 
        id: payload.userId, 
        orgId: payload.orgId,
        email: payload.email
      },
      include: { memberProfile: true }
    })

    if (!user || !user.memberProfile) {
      throw new BadRequestException('User or member profile not found')
    }

    if (user.memberProfile.membershipStatus !== 'INVITED') {
      throw new BadRequestException('Member has already been activated or is not in invited status')
    }

    // Hash the password
    const saltRounds = this.configService.get<number>('BCRYPT_ROUNDS', 12)
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Use transaction to update user and member profile atomically
    const result = await this.prisma.$transaction(async (tx) => {
      // Update user account
      await tx.userAccount.update({
        where: { id: user.id },
        data: {
          passwordHash,
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          emailVerificationToken: null // Clear any existing verification token
        }
      })

      // Update member profile to ACTIVE
      const updatedMember = await tx.memberProfile.update({
        where: { id: user.memberProfile!.id },
        data: {
          membershipStatus: 'ACTIVE',
          activatedAt: new Date(),
          isActive: true // Update legacy field
        }
      })

      // Create audit log
      await tx.auditLog.create({
        data: {
          orgId: payload.orgId,
          actorUserId: user.id,
          action: 'INVITE_ACCEPTED',
          targetType: 'Member',
          targetId: updatedMember.id,
          payload: {
            memberId: updatedMember.id,
            previousStatus: 'INVITED',
            newStatus: 'ACTIVE'
          }
        }
      })

      return { userId: user.id, memberId: updatedMember.id }
    })

    return { success: true, ...result }
  }
}