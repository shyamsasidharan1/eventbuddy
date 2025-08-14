import { Module } from '@nestjs/common'
import { MembersService } from './members.service'
import { MembersController } from './members.controller'
import { FamilyController } from './family.controller'
import { FamilyService } from './family.service'
import { InvitesModule } from '../invites/invites.module'
import { EmailModule } from '../email/email.module'
import { PrismaModule } from '../config/prisma.module'

@Module({
  imports: [PrismaModule, InvitesModule, EmailModule],
  controllers: [MembersController, FamilyController],
  providers: [MembersService, FamilyService],
  exports: [MembersService, FamilyService],
})
export class MembersModule {}