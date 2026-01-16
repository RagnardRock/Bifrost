import { Router } from 'express'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware'
import { statsController } from '../controllers/stats.controller'

const router = Router()

// All stats routes require admin authentication
router.use(authMiddleware, adminMiddleware)

// GET /api/admin/stats - Get dashboard statistics
router.get('/', statsController.getDashboardStats)

export default router
