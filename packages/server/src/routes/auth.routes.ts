import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { routesDoubleAuth } from './double-auth.routes'
import { Errors } from '../utils/errors'
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
}))


// GET /api/auth/me (requires auth)
router.get('/me', authMiddleware, authController.me)

export default router
