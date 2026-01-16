import { Router } from 'express'
import { userController } from '../controllers/user.controller'
import { validate } from '../middleware/validate.middleware'
import { authMiddleware } from '../middleware/auth.middleware'
import { createUserSchema, updateUserSchema } from '../validators/user.validator'

const router = Router({ mergeParams: true })

// All routes require admin authentication
router.use(authMiddleware)

// GET /api/admin/sites/:siteId/users - List all users for a site
router.get('/', userController.listBySite)

// GET /api/admin/sites/:siteId/users/:id - Get single user
router.get('/:id', userController.getById)

// POST /api/admin/sites/:siteId/users - Create new user
router.post('/', validate(createUserSchema), userController.create)

// PUT /api/admin/sites/:siteId/users/:id - Update user
router.put('/:id', validate(updateUserSchema), userController.update)

// DELETE /api/admin/sites/:siteId/users/:id - Delete user
router.delete('/:id', userController.delete)

export default router
