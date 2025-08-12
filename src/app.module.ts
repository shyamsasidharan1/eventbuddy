import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard } from '@nestjs/throttler'

import { PrismaModule } from './config/prisma.module'
import { AuthModule } from './auth/auth.module'
import { MembersModule } from './members/members.module'
import { EventsModule } from './events/events.module'
import { RegistrationsModule } from './registrations/registrations.module'
import { ReportsModule } from './reports/reports.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
      limit: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    }]),
    
    // Database
    PrismaModule,
    
    // Feature modules
    AuthModule,
    MembersModule,
    EventsModule,
    RegistrationsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}