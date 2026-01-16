import { Router } from 'express'
import { authMiddleware, clientMiddleware } from '../middleware/auth.middleware'
import { handleUpload } from '../middleware/upload.middleware'
import { clientController } from '../controllers/client.controller'

const router = Router()

// All client routes require authentication and client role
router.use(authMiddleware, clientMiddleware)

// GET /api/client/site - Get client's site info
router.get('/site', clientController.getSite)

// POST /api/client/upload - Upload an image (for client use)
router.post('/upload', handleUpload, clientController.uploadImage)

// GET /api/client/content - Get all content for client's site
router.get('/content', clientController.getContent)

// PUT /api/client/content - Update content for client's site
router.put('/content', clientController.updateContent)

// GET /api/client/collections - Get all collections for client's site
router.get('/collections', clientController.getAllCollections)

// GET /api/client/collections/:type - Get items of a specific collection type
router.get('/collections/:type', clientController.getCollectionItems)

// POST /api/client/collections/:type - Create a new collection item
router.post('/collections/:type', clientController.createCollectionItem)

// PUT /api/client/collections/:type/:id - Update a collection item
router.put('/collections/:type/:id', clientController.updateCollectionItem)

// DELETE /api/client/collections/:type/:id - Delete a collection item
router.delete('/collections/:type/:id', clientController.deleteCollectionItem)

// PUT /api/client/collections/:type/reorder - Reorder collection items
router.put('/collections/:type/reorder', clientController.reorderCollectionItems)

export default router
