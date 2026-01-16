import { Router } from 'express'
import { authController } from '../controllers/auth.controller'
import { validate } from '../middleware/validate.middleware'
import { authMiddleware } from '../middleware/auth.middleware'
import { loginSchema, clientLoginSchema } from '../validators/auth.validator'

const router = Router()

// POST /api/auth/admin/login
router.post('/admin/login', validate(loginSchema), authController.adminLogin)

// POST /api/auth/client/login
router.post('/client/login', validate(clientLoginSchema), authController.clientLogin)

// GET /api/auth/me (requires auth)
router.get('/me', authMiddleware, authController.me)

export default router
