import { Router } from 'express'
import { siteController } from '../controllers/site.controller'
import { validate } from '../middleware/validate.middleware'
import { authMiddleware } from '../middleware/auth.middleware'
import { createSiteSchema, updateSiteSchema } from '../validators/site.validator'

const router = Router()

// All routes require admin authentication
router.use(authMiddleware)

// GET /api/admin/sites - List all sites
router.get('/', siteController.list)

// GET /api/admin/sites/:id - Get single site
router.get('/:id', siteController.getById)

// POST /api/admin/sites - Create new site
router.post('/', validate(createSiteSchema), siteController.create)

// PUT /api/admin/sites/:id - Update site
router.put('/:id', validate(updateSiteSchema), siteController.update)

// DELETE /api/admin/sites/:id - Delete site
router.delete('/:id', siteController.delete)

// POST /api/admin/sites/:id/regenerate-key - Regenerate API key
router.post('/:id/regenerate-key', siteController.regenerateApiKey)

export default router
