/**
 * Comptes clients (v2) : connexion par e-mail, liens d'invitation et de mot de passe oublié.
 * Routes publiques, limitées en nombre de tentatives.
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { success } from '../utils/response'
import * as comptes from '../services/comptes.service'

const router = Router()

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Trop de tentatives. Réessayez dans un quart d’heure.' } },
}))

const action = (fn: (req: Request) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req).then((d) => res.json(success(d))).catch(next)

export const motDePasse = z.string().min(10, 'Le mot de passe doit faire au moins 10 caractères').max(200)

router.post('/connexion', action(async (req) => {
  const b = z.object({ email: z.string().email(), motDePasse: z.string().min(1).max(200), siteId: z.string().uuid().optional() }).parse(req.body)
  return comptes.connexion(b.email, b.motDePasse, b.siteId)
}))

router.post('/oubli', action(async (req) => comptes.oubli(z.object({ email: z.string().email() }).parse(req.body).email)))

const jeton = (req: Request) => z.string().min(20).max(100).parse((req.params as Record<string, string>).jeton)
router.get('/acces/:jeton', action(async (req) => comptes.lireJeton(jeton(req))))
router.post('/acces/:jeton', action(async (req) => comptes.utiliserJeton(jeton(req), z.object({ motDePasse }).parse(req.body).motDePasse)))

export default router
