import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'
import { PrismaService } from '../config/prisma.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { CreateAdminDto } from './dto/create-admin.dto'
import { UpdateUserRoleDto } from './dto/update-user-role.dto'
import { UserAccount, UserRole, MembershipCategory } from '@prisma/client'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.userAccount.findFirst({
      where: { email },
      include: {
        org: true,
        memberProfile: true,
      },
    })

    if (user && await bcrypt.compare(password, user.passwordHash)) {
      const { passwordHash, ...result } = user
      return result
    }
    return null
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password)
    if (!user) {
      throw new UnauthorizedException('Invalid credentials')
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive')
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
    }

    // Update last login
    await this.prisma.userAccount.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        orgId: user.orgId,
        organization: user.org,
        memberProfile: user.memberProfile,
      },
    }
  }

  async register(registerDto: RegisterDto) {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.userAccount.findFirst({
        where: { email: registerDto.email },
      })

      if (existingUser) {
        throw new UnauthorizedException('User already exists with this email')
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12
      const passwordHash = await bcrypt.hash(registerDto.password, saltRounds)

      // Create user account
      const user = await this.prisma.userAccount.create({
      data: {
        email: registerDto.email,
        passwordHash,
        role: UserRole.MEMBER, // Default role
        orgId: parseInt(registerDto.orgId),
        isActive: true,
      },
      include: {
        org: true,
      },
    })

    // Calculate next payment due date based on membership category
    const now = new Date()
    let nextPaymentDue: Date | null = null
    
    if (registerDto.membershipCategory !== MembershipCategory.LIFE && 
        registerDto.membershipCategory !== MembershipCategory.HONORARY) {
      // For non-lifetime memberships, set next payment due to 1 year from now
      nextPaymentDue = new Date()
      nextPaymentDue.setFullYear(now.getFullYear() + 1)
    }

    // Create member profile
    await this.prisma.memberProfile.create({
      data: {
        userId: user.id,
        orgId: user.orgId,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone,
        
        // Membership details
        membershipCategory: registerDto.membershipCategory || MembershipCategory.REGULAR,
        membershipFee: registerDto.membershipFee ? parseFloat(registerDto.membershipFee) : 0.00,
        membershipNotes: registerDto.membershipNotes,
        lastPaymentDate: registerDto.membershipFee ? now : null,
        nextPaymentDue,
        
        emergencyContact: {
          name: registerDto.emergencyContact || '',
          phone: '',
          relationship: ''
        },
        metadata: {
          allergies: registerDto.allergies || '',
          notes: registerDto.notes || ''
        },
      },
    })

      const { passwordHash: _, ...userWithoutPassword } = user
      
      return userWithoutPassword
    } catch (error) {
      throw error
    }
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.userAccount.findUnique({
      where: { id: parseInt(userId) },
      include: {
        org: true,
        memberProfile: {
          include: {
            family: true,
          },
        },
      },
    })

    if (!user) {
      throw new UnauthorizedException('User not found')
    }

    const { passwordHash, ...userWithoutPassword } = user
    
    return userWithoutPassword
  }

  async createAdmin(createAdminDto: CreateAdminDto, creatorOrgId: number, creatorRole: UserRole) {
    // Only ORG_ADMIN can create other admins
    if (creatorRole !== UserRole.ORG_ADMIN) {
      throw new UnauthorizedException('Only organization admins can create admin users')
    }

    // Check if user already exists
    const existingUser = await this.prisma.userAccount.findFirst({
      where: { 
        email: createAdminDto.email,
        orgId: creatorOrgId
      },
    })

    if (existingUser) {
      throw new UnauthorizedException('User already exists with this email')
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12
    const passwordHash = await bcrypt.hash(createAdminDto.password, saltRounds)

    // Create user account with specified role
    const user = await this.prisma.userAccount.create({
      data: {
        email: createAdminDto.email,
        passwordHash,
        role: createAdminDto.role,
        orgId: creatorOrgId,
        isActive: true,
      },
      include: {
        org: true,
      },
    })

    // Calculate next payment due date based on membership category
    const now = new Date()
    let nextPaymentDue: Date | null = null
    
    if (createAdminDto.membershipCategory !== MembershipCategory.LIFE && 
        createAdminDto.membershipCategory !== MembershipCategory.HONORARY) {
      nextPaymentDue = new Date()
      nextPaymentDue.setFullYear(now.getFullYear() + 1)
    }

    // Create member profile
    await this.prisma.memberProfile.create({
      data: {
        userId: user.id,
        orgId: user.orgId,
        firstName: createAdminDto.firstName,
        lastName: createAdminDto.lastName,
        phone: createAdminDto.phone,
        
        // Membership details
        membershipCategory: createAdminDto.membershipCategory || MembershipCategory.REGULAR,
        membershipNotes: createAdminDto.membershipNotes,
        nextPaymentDue,
        
        emergencyContact: {
          name: createAdminDto.emergencyContact || '',
          phone: '',
          relationship: ''
        },
        metadata: {},
      },
    })

    const { passwordHash: _, ...userWithoutPassword } = user
    
    return {
      ...userWithoutPassword,
      message: `Admin user created successfully with ${createAdminDto.role} role`
    }
  }

  async updateUserRole(userId: string, updateUserRoleDto: UpdateUserRoleDto, updaterOrgId: number, updaterRole: UserRole) {
    // Only ORG_ADMIN can update user roles
    if (updaterRole !== UserRole.ORG_ADMIN) {
      throw new UnauthorizedException('Only organization admins can update user roles')
    }

    const targetUser = await this.prisma.userAccount.findUnique({
      where: {
        id: parseInt(userId),
        orgId: updaterOrgId,
      },
      include: {
        memberProfile: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      }
    })

    if (!targetUser) {
      throw new UnauthorizedException('User not found')
    }

    // Update user role
    const updatedUser = await this.prisma.userAccount.update({
      where: { id: parseInt(userId) },
      data: { role: updateUserRoleDto.role },
      include: {
        memberProfile: {
          select: {
            firstName: true,
            lastName: true,
          }
        }
      }
    })

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      firstName: updatedUser.memberProfile?.firstName,
      lastName: updatedUser.memberProfile?.lastName,
      message: `User role updated to ${updateUserRoleDto.role} successfully`
    }
  }

  async bootstrapSuperAdmin(email: string, password: string, orgId: number) {
    // This method should only be used for initial setup
    // Check if any ORG_ADMIN already exists in this organization
    const existingAdmin = await this.prisma.userAccount.findFirst({
      where: {
        orgId,
        role: UserRole.ORG_ADMIN,
      }
    })

    if (existingAdmin) {
      throw new UnauthorizedException('Organization already has admin users')
    }

    // Check if user already exists
    const existingUser = await this.prisma.userAccount.findFirst({
      where: { email, orgId },
    })

    if (existingUser) {
      throw new UnauthorizedException('User already exists with this email')
    }

    // Hash password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Create super admin user
    const user = await this.prisma.userAccount.create({
      data: {
        email,
        passwordHash,
        role: UserRole.ORG_ADMIN,
        orgId,
        isActive: true,
      },
      include: {
        org: true,
      },
    })

    // Create member profile
    await this.prisma.memberProfile.create({
      data: {
        userId: user.id,
        orgId: user.orgId,
        firstName: 'Super',
        lastName: 'Admin',
        phone: '000-000-0000',
        membershipCategory: MembershipCategory.HONORARY,
        membershipNotes: 'Initial super admin - should be deleted after delegation',
        emergencyContact: {},
        metadata: {},
      },
    })

    const { passwordHash: _, ...userWithoutPassword } = user
    
    return {
      ...userWithoutPassword,
      message: 'Super admin created successfully. Please create a proper admin user and delete this account.'
    }
  }
}