import { Router } from 'express'
import { collectionController } from '../controllers/collection.controller'
import { authMiddleware } from '../middleware/auth.middleware'

const router = Router({ mergeParams: true })

// All routes require admin authentication
router.use(authMiddleware)

// GET /api/admin/sites/:siteId/collections - Get all collections
router.get('/', collectionController.getAllCollections)

// GET /api/admin/sites/:siteId/collections/:type - List items in collection
router.get('/:type', collectionController.listItems)

// POST /api/admin/sites/:siteId/collections/:type - Create item
router.post('/:type', collectionController.createItem)

// PUT /api/admin/sites/:siteId/collections/:type/reorder - Reorder items
router.put('/:type/reorder', collectionController.reorderItems)

// GET /api/admin/sites/:siteId/collections/:type/:id - Get single item
router.get('/:type/:id', collectionController.getItem)

// PUT /api/admin/sites/:siteId/collections/:type/:id - Update item
router.put('/:type/:id', collectionController.updateItem)

// DELETE /api/admin/sites/:siteId/collections/:type/:id - Delete item
router.delete('/:type/:id', collectionController.deleteItem)

export default router
