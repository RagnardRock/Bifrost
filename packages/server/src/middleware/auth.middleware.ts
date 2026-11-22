import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'
import { AppError, Errors } from '../utils/errors'
import { COOKIE_SESSION, ENTETE_INTERFACE, jetonDeLaRequete, poserSession, retirerSession } from '../utils/session'
import type { TokenPayload } from '@bifrost/shared'

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload
    }
  }
}

/** Routes ouvertes à une session limitée (compte dev sans double authentification) */
const OUVERT_SANS_DOUBLE_AUTH = /^\/api\/auth\/(me|double-auth|deconnexion)(\/|\?|$)/

/**
 * Vérifie le jeton (cookie de session, ou en-tête Authorization) et range son contenu dans req.user.
 * Par cookie, une modification doit venir de l'interface (en-tête X-Bifrost) : protection contre le CSRF.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const trouve = jetonDeLaRequete(req)
  if (!trouve) return next(Errors.unauthorized('Token manquant'))

  let payload: TokenPayload
  try {
    payload = verifyToken(trouve.jeton)
  } catch {
    if (trouve.parCookie) retirerSession(res)
    return next(Errors.unauthorized('Token invalide ou expiré'))
  }

  if (trouve.parCookie && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.headers[ENTETE_INTERFACE]) {
    return next(Errors.forbidden('Requête refusée'))
  }
  if (payload.portee === 'double-auth' && !OUVERT_SANS_DOUBLE_AUTH.test(req.originalUrl)) {
    return next(new AppError('DOUBLE_AUTH_A_ACTIVER', 'Activez d’abord la double authentification de votre compte', 403))
  }
  // Ancienne session (jeton gardé par le navigateur) : passe dans le cookie
  if (!trouve.parCookie && !req.cookies?.[COOKIE_SESSION] && req.headers[ENTETE_INTERFACE]) {
    poserSession(res, trouve.jeton, payload.role)
  }
  req.user = payload
  next()
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
