import { Router } from 'express'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware'
import { activityController } from '../controllers/activity.controller'

const router = Router()

// All activity routes require admin authentication
router.use(authMiddleware, adminMiddleware)

// GET /api/admin/activity - Get activity across all sites
router.get('/', activityController.getActivity)

export default router
