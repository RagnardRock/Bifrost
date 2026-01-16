import rateLimit from 'express-rate-limit'
import { RATE_LIMIT_PUBLIC, RATE_LIMIT_CLIENT, RATE_LIMIT_ADMIN } from '@bifrost/shared'

/**
 * Rate limiter for public API (100 requests per minute)
 */
export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: RATE_LIMIT_PUBLIC,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de requetes. Veuillez reessayer dans une minute.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use API key as identifier if present, otherwise IP
    return (req.headers['x-api-key'] as string) || req.ip || 'unknown'
  },
})

/**
 * Rate limiter for client API (200 requests per minute)
 */
export const clientRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: RATE_LIMIT_CLIENT,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de requetes. Veuillez reessayer dans une minute.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Rate limiter for admin API (500 requests per minute)
 */
export const adminRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: RATE_LIMIT_ADMIN,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de requetes. Veuillez reessayer dans une minute.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
})
