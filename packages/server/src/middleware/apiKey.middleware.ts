import type { Request, Response, NextFunction } from 'express'
import { siteRepository } from '../repositories/site.repository'
import { Errors } from '../utils/errors'
import type { Site } from '@prisma/client'

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      site?: Site
    }
  }
}

/**
 * Middleware to verify API key from header
 * Expects: X-API-Key header
 * Adds site to req.site
 */
export async function apiKeyMiddleware(req: Request, _res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string | undefined

  if (!apiKey) {
    return next(Errors.unauthorized('Cle API manquante'))
  }

  try {
    const site = await siteRepository.findByApiKey(apiKey)

    if (!site) {
      return next(Errors.unauthorized('Cle API invalide'))
    }

    req.site = site
    next()
  } catch (error) {
    next(Errors.internal('Erreur de verification de la cle API'))
  }
}
