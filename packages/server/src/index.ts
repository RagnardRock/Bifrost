import { app } from './app'
import { config } from './config'
import { logger } from './utils/logger'
import { prisma } from './config/database'

async function main() {
  try {
    // Test database connection
    await prisma.$connect()
    logger.info('Database connected')

    // Start server
    app.listen(config.port, () => {
      logger.info(`Server running on http://localhost:${config.port}`)
      logger.info(`Environment: ${config.nodeEnv}`)
    })
  } catch (error) {
    logger.error(error, 'Failed to start server')
    process.exit(1)
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error(error, 'Uncaught exception')
  process.exit(1)
})

process.on('unhandledRejection', (error) => {
  logger.error(error, 'Unhandled rejection')
  process.exit(1)
})

main()
