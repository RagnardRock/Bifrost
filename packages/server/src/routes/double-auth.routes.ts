/**
 * Réglage de la double authentification d'un compte (client ou dev) : état, QR code, activation, désactivation, codes de secours.
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { success } from '../utils/response'
import * as doubleAuth from '../services/double-auth.service'

const code = z.string().trim().min(6).max(20)

export function routesDoubleAuth(qui: (req: Request) => { genre: doubleAuth.Genre; id: string }) {
  const router = Router()
  const action = (fn: (req: Request) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => Promise.resolve().then(() => fn(req)).then((d) => res.json(success(d))).catch(next)
  const q = (req: Request) => qui(req)

  router.get('/', action(async (req) => { const { genre, id } = q(req); return doubleAuth.etat(genre, id) }))
  router.post('/preparer', action(async (req) => { const { genre, id } = q(req); return doubleAuth.preparer(genre, id) }))
  router.post('/activer', action(async (req) => {
    const { genre, id } = q(req)
    return doubleAuth.activer(genre, id, z.object({ code }).parse(req.body).code)
  }))
  router.post('/desactiver', action(async (req) => {
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
