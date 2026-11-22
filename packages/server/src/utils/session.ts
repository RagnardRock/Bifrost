/**
 * Session de l'interface Bifrost : le jeton est rangé dans un cookie que le navigateur garde
 * et que le JavaScript de la page ne peut pas lire (httpOnly). Une page piégée ne peut donc pas le voler.
 */
import type { Request, Response } from 'express'
import { config } from '../config'
import { decodeToken } from './jwt'
import type { TokenPayload } from '@bifrost/shared'

export const COOKIE_SESSION = 'bf_session'
/** En-tête envoyé par l'interface : un autre site ne peut pas l'ajouter sans l'accord de Bifrost (CORS). */
export const ENTETE_INTERFACE = 'x-bifrost'

const duree = (role: TokenPayload['role']) => (role === 'admin' ? 7 : 1) * 24 * 3600 * 1000

export function poserSession(res: Response, token: string, role: TokenPayload['role']) {
  res.cookie(COOKIE_SESSION, token, { httpOnly: true, secure: !config.isDev, sameSite: 'strict', path: '/api', maxAge: duree(role) })
}

export function retirerSession(res: Response) {
  res.clearCookie(COOKIE_SESSION, { httpOnly: true, secure: !config.isDev, sameSite: 'strict', path: '/api' })
}

/** Jeton de la requête : en-tête Authorization (outils, anciens onglets), sinon cookie de session. */
export function jetonDeLaRequete(req: Request): { jeton: string; parCookie: boolean } | null {
  const h = req.headers.authorization
  if (h?.startsWith('Bearer ')) return { jeton: h.slice(7), parCookie: false }
  const c = (req.cookies as Record<string, string> | undefined)?.[COOKIE_SESSION]
  return c ? { jeton: c, parCookie: true } : null
}

/** Une réponse qui ouvre une session ({ token, … }) pose aussi le cookie. */
export function sessionDansLaReponse(res: Response, d: unknown) {
  if (d && typeof d === 'object' && typeof (d as { token?: unknown }).token === 'string') {
    const t = (d as { token: string }).token
    poserSession(res, t, decodeToken(t)?.role === 'admin' ? 'admin' : 'client')
  }
}
