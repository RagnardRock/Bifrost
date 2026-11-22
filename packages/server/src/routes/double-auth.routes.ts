/**
 * Réglage de la double authentification d'un compte (client ou dev) : état, QR code, activation, désactivation, codes de secours.
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { success } from '../utils/response'
import { Errors } from '../utils/errors'
import * as doubleAuth from '../services/double-auth.service'

const code = z.string().trim().min(6).max(20)

export interface OptionsDoubleAuth {
  /** Après l'activation (ex. : session complète pour le compte dev) */
  apresActivation?: (req: Request, res: Response) => Record<string, unknown>
  /** La désactiver est interdit (compte dev en ligne) */
  desactivationInterdite?: () => boolean
}

export function routesDoubleAuth(qui: (req: Request) => { genre: doubleAuth.Genre; id: string }, options: OptionsDoubleAuth = {}) {
  const router = Router()
  const action = (fn: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => Promise.resolve().then(() => fn(req, res)).then((d) => res.json(success(d))).catch(next)
  const q = (req: Request) => qui(req)

  router.get('/', action(async (req) => { const { genre, id } = q(req); return doubleAuth.etat(genre, id) }))
  router.post('/preparer', action(async (req) => { const { genre, id } = q(req); return doubleAuth.preparer(genre, id) }))
  router.post('/activer', action(async (req, res) => {
    const { genre, id } = q(req)
    const r = await doubleAuth.activer(genre, id, z.object({ code }).parse(req.body).code)
    return { ...r, ...(options.apresActivation?.(req, res) ?? {}) }
  }))
  router.post('/desactiver', action(async (req) => {
    if (options.desactivationInterdite?.()) throw Errors.badRequest('La double authentification est obligatoire pour le compte dev. Pour changer de téléphone, utilisez un code de secours.')
    const { genre, id } = q(req)
    const b = z.object({ motDePasse: z.string().min(1).max(200), code }).parse(req.body)
    return doubleAuth.desactiver(genre, id, b.motDePasse, b.code)
  }))
  router.post('/codes', action(async (req) => {
    const { genre, id } = q(req)
    return doubleAuth.nouveauxCodes(genre, id, z.object({ code }).parse(req.body).code)
  }))
  return router
}
