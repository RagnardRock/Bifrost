import { Router } from 'express'
import { schemaController } from '../controllers/schema.controller'
import { authMiddleware } from '../middleware/auth.middleware'

const router = Router({ mergeParams: true })

// All routes require admin authentication
router.use(authMiddleware)

// GET /api/admin/sites/:siteId/schema - Get site schema as YAML
router.get('/', schemaController.getSchema)

// PUT /api/admin/sites/:siteId/schema - Update site schema
router.put('/', schemaController.updateSchema)

// DELETE /api/admin/sites/:siteId/schema - Clear site schema
router.delete('/', schemaController.clearSchema)

// POST /api/admin/sites/:siteId/schema/validate - Validate without saving
router.post('/validate', schemaController.validateSchema)

export default router
