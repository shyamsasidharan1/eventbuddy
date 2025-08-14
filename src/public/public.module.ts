import { Module } from '@nestjs/common'
import { PublicController } from './public.controller'
import { PublicService } from './public.service'
import { ValidationService } from './validation.service'
import { PrismaModule } from '../config/prisma.module'
import { EmailModule } from '../email/email.module'

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [PublicController],
  providers: [PublicService, ValidationService],
  exports: [PublicService, ValidationService]
})
export class PublicModule {}