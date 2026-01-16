import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'
import { Errors } from '../utils/errors'
import type { TokenPayload } from '@bifrost/shared'

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload
    }
  }
}

/**
 * Middleware to verify JWT token
 * Adds user payload to req.user
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return next(Errors.unauthorized('Token manquant'))
  }

  const token = authHeader.slice(7)

  try {
    const payload = verifyToken(token)
    req.user = payload
    next()
  } catch (error) {
    next(Errors.unauthorized('Token invalide ou expiré'))
  }
}

/**
 * Middleware to require admin role
 * Must be used after authMiddleware
 */
export function adminMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return next(Errors.forbidden('Accès réservé aux administrateurs'))
  }
  next()
}

/**
 * Middleware to require client role with site access
 * Must be used after authMiddleware
 */
export function clientMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== 'client' || !req.user?.siteId) {
    return next(Errors.forbidden('Accès réservé aux clients'))
  }
  next()
}
