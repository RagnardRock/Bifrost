import pino from 'pino'
import { config } from '../config'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: config.isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      }
    : undefined,
})
