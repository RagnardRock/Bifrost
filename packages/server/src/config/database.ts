import { PrismaClient } from '@prisma/client'
import { config } from './index'

export const prisma = new PrismaClient({
  log: config.isDev ? ['query', 'error', 'warn'] : ['error'],
})

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})
