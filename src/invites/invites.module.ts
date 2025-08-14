import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule } from '@nestjs/config'
import { InvitesController } from './invites.controller'
import { InvitesService } from './invites.service'
import { PrismaModule } from '../config/prisma.module'

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.register({}) // JWT configuration will be handled in service
  ],
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService]
})
export class InvitesModule {}