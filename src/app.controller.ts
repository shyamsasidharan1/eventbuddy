import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'
import { AppService } from './app.service'

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get API welcome message' })
  @ApiResponse({ status: 200, description: 'Welcome message with API info' })
  getWelcome() {
    return this.appService.getWelcome()
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Health check information' })
  getHealth() {
    return this.appService.getHealth()
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Readiness status' })
  getReady() {
    return this.appService.getReady()
  }
}