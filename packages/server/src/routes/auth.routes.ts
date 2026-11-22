import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { routesDoubleAuth } from './double-auth.routes'
import { Errors } from '../utils/errors'
import { config } from '../config'
import { signToken } from '../utils/jwt'
import { success } from '../utils/response'
import { poserSession, retirerSession } from '../utils/session'
import { authController } from '../controllers/auth.controller'
import { validate } from '../middleware/validate.middleware'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware'
import { loginSchema, setupSchema } from '../validators/auth.validator'

const router = Router()

// POST /api/auth/setup (create first admin - requires SETUP_TOKEN)
router.post('/setup', validate(setupSchema), authController.setup)

// Connexion et réglages sensibles du dev : nombre de tentatives limité
const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Trop de tentatives. Réessayez dans un quart d’heure.' } },
})

// POST /api/auth/admin/login (code de double authentification si elle est active)
router.post('/admin/login', limite, validate(loginSchema), authController.adminLogin)

// Double authentification du compte dev
router.use('/double-auth', limite, authMiddleware, adminMiddleware, routesDoubleAuth((req) => {
  if (!req.user?.adminId) throw Errors.forbidden()
  return { genre: 'admin', id: req.user.adminId }
}, {
  // Activée : la session limitée devient une session complète
  apresActivation: (req, res) => {
    const token = signToken({ adminId: req.user!.adminId, role: 'admin' })
    poserSession(res, token, 'admin')
    return { token }
  },
  desactivationInterdite: () => config.doubleAuthDevObligatoire,
}))

// POST /api/auth/deconnexion : le navigateur oublie la session
router.post('/deconnexion', (_req, res) => {
  retirerSession(res)
  res.json(success({ ok: true }))
})


// GET /api/auth/me (requires auth)
router.get('/me', authMiddleware, authController.me)

export default router
