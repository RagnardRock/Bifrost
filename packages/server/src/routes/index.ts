import { Router } from 'express'
import authRoutes from './auth.routes'
import siteRoutes from './site.routes'
import userRoutes from './user.routes'
import schemaRoutes from './schema.routes'
import contentRoutes from './content.routes'
import collectionRoutes from './collection.routes'
import webhookRoutes from './webhook.routes'
import historyRoutes from './history.routes'
import statsRoutes from './stats.routes'
import activityRoutes from './activity.routes'
import clientRoutes from './client.routes'
import publicRoutes from './public.routes'
import uploadRoutes from './upload.routes'
import { schemaController } from '../controllers/schema.controller'
import { statsController } from '../controllers/stats.controller'
import { activityController } from '../controllers/activity.controller'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware'

const router = Router()

// Auth routes
router.use('/auth', authRoutes)

// Admin routes
router.use('/admin/sites', siteRoutes)
router.use('/admin/sites/:siteId/users', userRoutes)
router.use('/admin/sites/:siteId/schema', schemaRoutes)
router.use('/admin/sites/:siteId/content', contentRoutes)
router.use('/admin/sites/:siteId/collections', collectionRoutes)
router.use('/admin/sites/:siteId/webhooks', webhookRoutes)
router.use('/admin/sites/:siteId/history', historyRoutes)
router.use('/admin/upload', uploadRoutes)
router.use('/admin/stats', statsRoutes)
router.use('/admin/activity', activityRoutes)

// Schema example (doesn't need siteId)
router.get('/admin/schema/example', authMiddleware, schemaController.getExample)

// Site-specific stats and activity
router.get('/admin/sites/:siteId/stats', authMiddleware, adminMiddleware, statsController.getSiteStats)
router.get('/admin/sites/:siteId/activity', authMiddleware, adminMiddleware, activityController.getSiteActivity)

// Client routes (siteId from JWT token)
router.use('/client', clientRoutes)

// Public API routes (API key authentication)
router.use('/public', publicRoutes)

export default router
