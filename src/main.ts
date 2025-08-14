import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import helmet from 'helmet'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }))

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }))

  // Enable CORS
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.FRONTEND_URL] 
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  })

  // Swagger API documentation
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('EventBuddy API')
      .setDescription('Phase 1: Charity Member & Events Management API')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .build()
    
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
  }

  // Global prefix
  app.setGlobalPrefix('api/v1')

  const port = process.env.PORT || 3001
  await app.listen(port)
  
  console.log(`🚀 EventBuddy API is running on: http://localhost:${port}/api/v1`)
  console.log(`📖 API Documentation: http://localhost:${port}/api/docs`)
  console.log(`🏢 Environment: ${process.env.NODE_ENV || 'development'}`)

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('📤 SIGTERM received, shutting down gracefully...')
    await app.close()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('📤 SIGINT received, shutting down gracefully...')
    await app.close()
    process.exit(0)
  })
}

bootstrap()