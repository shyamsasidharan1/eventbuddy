const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const winston = require('winston')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3000

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'eventbuddy-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})

app.use(helmet())
app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`)
  next()
})

app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to EventBuddy API!',
    version: '1.0.0',
    service: 'eventbuddy-api',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  })
})

app.get('/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    service: 'eventbuddy-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  }

  res.status(200).json(healthCheck)
})

app.get('/ready', (req, res) => {
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString()
  })
})

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: req.originalUrl
  })
})

app.use((err, req, res) => {
  logger.error(err.stack)
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong!'
  })
})

// Only start server if this file is run directly (not imported for testing)
if (require.main === module) {
  const server = app.listen(PORT, () => {
    logger.info(`EventBuddy API server is running on port ${PORT}`)
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`)
  })

  const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`)
    server.close(() => {
      logger.info('Process terminated')
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
}

module.exports = app
