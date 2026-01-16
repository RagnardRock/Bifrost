import { Router } from 'express'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware'
import { webhookController } from '../controllers/webhook.controller'

const router = Router({ mergeParams: true })

// All webhook routes require admin authentication
router.use(authMiddleware, adminMiddleware)

// GET /api/admin/sites/:siteId/webhooks - Get webhook logs
router.get('/', webhookController.getLogs)

// POST /api/admin/sites/:siteId/webhooks/test - Send test webhook
router.post('/test', webhookController.sendTest)

export default router
