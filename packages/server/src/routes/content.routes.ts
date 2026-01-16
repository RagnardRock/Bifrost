import { Router } from 'express'
import { contentController } from '../controllers/content.controller'
import { authMiddleware } from '../middleware/auth.middleware'

const router = Router({ mergeParams: true })

// All routes require admin authentication
router.use(authMiddleware)

// GET /api/admin/sites/:siteId/content - Get all content
router.get('/', contentController.getContent)

// PUT /api/admin/sites/:siteId/content - Update multiple fields
router.put('/', contentController.updateContent)

// GET /api/admin/sites/:siteId/content/:fieldKey - Get single field
router.get('/:fieldKey', contentController.getFieldContent)

// PUT /api/admin/sites/:siteId/content/:fieldKey - Update single field
router.put('/:fieldKey', contentController.updateFieldContent)

// DELETE /api/admin/sites/:siteId/content/:fieldKey - Delete field content
router.delete('/:fieldKey', contentController.deleteFieldContent)

export default router
