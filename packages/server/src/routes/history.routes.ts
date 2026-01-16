import { Router } from 'express'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware'
import { historyController } from '../controllers/history.controller'

const router = Router({ mergeParams: true })

// All history routes require admin authentication
router.use(authMiddleware, adminMiddleware)

// GET /api/admin/sites/:siteId/history - Get all history for site
router.get('/', historyController.getSiteHistory)

// GET /api/admin/sites/:siteId/history/field/:fieldKey - Get field history
router.get('/field/:fieldKey', historyController.getFieldHistory)

// GET /api/admin/sites/:siteId/history/item/:itemId - Get item history
router.get('/item/:itemId', historyController.getItemHistory)

// POST /api/admin/sites/:siteId/history/:historyId/restore - Restore to previous state
router.post('/:historyId/restore', historyController.restore)

export default router
