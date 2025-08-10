import { Injectable } from '@nestjs/common'

@Injectable()
export class AppService {
  getWelcome() {
    return {
      message: 'Welcome to EventBuddy API - Phase 1 MVP1',
      version: '1.0.0',
      service: 'eventbuddy-api',
      environment: process.env.NODE_ENV || 'development',
      features: [
        'User Authentication & Role-Based Access',
        'Member & Family Management',
        'Event Creation & Registration',
        'Staff Check-in System',
        'Comprehensive Reporting & CSV Export'
      ],
      documentation: '/api/docs',
      timestamp: new Date().toISOString()
    }
  }

  getHealth() {
    const uptime = process.uptime()
    return {
      status: 'OK',
      uptime: Math.floor(uptime),
      timestamp: new Date().toISOString(),
      service: 'eventbuddy-api',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: 'PostgreSQL with Prisma',
      cache: 'Redis'
    }
  }

  getReady() {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ready',
        cache: 'ready',
        auth: 'ready'
      }
    }
  }
}