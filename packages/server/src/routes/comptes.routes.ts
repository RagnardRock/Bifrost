/**
 * Comptes clients (v2) : connexion par e-mail, liens d'invitation et de mot de passe oublié.
 * Routes publiques, limitées en nombre de tentatives.
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { success } from '../utils/response'
import * as comptes from '../services/comptes.service'
import { authMiddleware } from '../middleware/auth.middleware'
import { Errors } from '../utils/errors'
import { routesDoubleAuth } from './double-auth.routes'
import * as notifications from '../services/notifications.service'

const router = Router()

const action = (fn: (req: Request) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req).then((d) => res.json(success(d))).catch(next)

// Client connecté : ses sites, et passer de l'un à l'autre sans retaper son mot de passe
const client = (req: Request) => {
  if (req.user?.role !== 'client' || !req.user.userId) throw Errors.forbidden('Réservé aux comptes clients')
  return req.user.userId
}
router.get('/mes-sites', authMiddleware, action(async (req) => comptes.mesSites(client(req))))
router.post('/changer-site', authMiddleware, action(async (req) =>
  comptes.changerDeSite(client(req), z.object({ site: z.string().min(1).max(80) }).parse(req.body).site)))

// Client connecté : notifications sur ses appareils
router.get('/notifications', authMiddleware, action(async (req) => notifications.reglages(client(req))))
router.put('/notifications', authMiddleware, action(async (req) =>
  notifications.modifierReglages(client(req), z.object({ messages: z.boolean().optional(), aPublier: z.boolean().optional() }).parse(req.body))))
const schemaAbonnement = z.object({
  endpoint: z.string().url().max(1000).refine((u) => u.startsWith('https://'), 'Adresse de notification invalide'),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
})
router.post('/notifications/appareils', authMiddleware, action(async (req) => notifications.abonner(client(req), schemaAbonnement.parse(req.body))))
router.post('/notifications/appareils/retirer', authMiddleware, action(async (req) =>
  notifications.desabonner(client(req), z.object({ endpoint: z.string().max(1000) }).parse(req.body).endpoint)))

// Le reste est public : nombre de tentatives limité

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Trop de tentatives. Réessayez dans un quart d’heure.' } },
}))

export const motDePasse = z.string().min(10, 'Le mot de passe doit faire au moins 10 caractères').max(200)

router.post('/connexion', action(async (req) => {
  const b = z.object({ email: z.string().email(), motDePasse: z.string().min(1).max(200), siteId: z.string().min(1).max(80).optional(), code: z.string().trim().max(20).optional() }).parse(req.body)
  return comptes.connexion(b.email, b.motDePasse, b.siteId, b.code)
}))

router.post('/oubli', action(async (req) => comptes.oubli(z.object({ email: z.string().email() }).parse(req.body).email)))

const jeton = (req: Request) => z.string().min(20).max(100).parse((req.params as Record<string, string>).jeton)
router.get('/acces/:jeton', action(async (req) => comptes.lireJeton(jeton(req))))
// Client connecté : changer son mot de passe (tentatives limitées ci-dessus)
router.post('/mot-de-passe', authMiddleware, action(async (req) => {
  const b = z.object({ actuel: z.string().min(1).max(200), nouveau: motDePasse }).parse(req.body)
  return comptes.changerMotDePasse(client(req), req.user?.siteId, b.actuel, b.nouveau)
}))

// Client connecté : double authentification (tentatives limitées ci-dessus)
router.use('/double-auth', authMiddleware, routesDoubleAuth((req) => ({ genre: 'user', id: client(req) })))

router.post('/acces/:jeton', action(async (req) => comptes.utiliserJeton(jeton(req), z.object({ motDePasse }).parse(req.body).motDePasse)))

export default router
