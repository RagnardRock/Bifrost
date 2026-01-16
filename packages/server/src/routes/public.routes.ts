import { Router } from 'express'
import { apiKeyMiddleware } from '../middleware/apiKey.middleware'
import { publicRateLimiter } from '../middleware/rateLimit.middleware'
import { publicController } from '../controllers/public.controller'

const router = Router()

// Apply rate limiting and API key authentication
router.use(publicRateLimiter)
router.use(apiKeyMiddleware)

// GET /api/public/site - Get site info (id, name, schema)
router.get('/site', publicController.getSiteInfo)

// GET /api/public/all - Get all content and collections
router.get('/all', publicController.getAll)

// GET /api/public/content - Get all content fields
router.get('/content', publicController.getContent)

// GET /api/public/content/:fieldKey - Get a specific field
router.get('/content/:fieldKey', publicController.getFieldContent)

// GET /api/public/collections - Get all collections
router.get('/collections', publicController.getAllCollections)

// GET /api/public/collections/:type - Get items of a collection
router.get('/collections/:type', publicController.getCollectionItems)

// GET /api/public/collections/:type/:id - Get a specific item
router.get('/collections/:type/:id', publicController.getCollectionItem)

export default router
