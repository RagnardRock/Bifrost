import { app } from './app'
import { config } from './config'
import { logger } from './utils/logger'
import { prisma } from './config/database'
import { completerSlugs } from './services/slug.service'
import { purgerCorbeille } from './services/clients.service'

async function main() {
  try {
    // Test database connection
    await prisma.$connect()
    logger.info('Database connected')
    await completerSlugs().catch((e) => logger.warn(e, 'Noms courts des sites non complétés'))
    // Sites supprimés depuis plus de 30 jours : effacés au démarrage puis chaque jour
    const purger = () => purgerCorbeille().catch((e) => logger.warn(e, 'Corbeille non vidée'))
    void purger()
    setInterval(purger, 24 * 3600 * 1000).unref()

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
