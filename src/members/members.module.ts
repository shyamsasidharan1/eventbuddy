import { Module } from '@nestjs/common'
import { MembersService } from './members.service'
import { MembersController } from './members.controller'
import { FamilyController } from './family.controller'
import { FamilyService } from './family.service'

@Module({
  controllers: [MembersController, FamilyController],
  providers: [MembersService, FamilyService],
  exports: [MembersService, FamilyService],
})
export class MembersModule {}