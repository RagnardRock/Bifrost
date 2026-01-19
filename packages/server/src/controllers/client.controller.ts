import type { Request, Response, NextFunction } from 'express'
import { siteRepository } from '../repositories/site.repository'
import { contentService } from '../services/content.service'
import { collectionService } from '../services/collection.service'
import { cloudinaryService } from '../services/cloudinary.service'
import { success } from '../utils/response'
import { Errors } from '../utils/errors'

/**
 * Get siteId from authenticated user
 */
function getSiteId(req: Request): string {
  const siteId = req.user?.siteId
  if (!siteId) {
    throw Errors.unauthorized('Site ID manquant')
  }
  return siteId
}

export const clientController = {
  /**
   * GET /api/client/site
   * Get client's site info
   */
  async getSite(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = getSiteId(req)
      const site = await siteRepository.findById(siteId)

      if (!site) {
        throw Errors.notFound('Site')
      }

      res.json(success({
        id: site.id,
        name: site.name,
        url: site.url,
        schema: site.schema,
      }))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/client/content
   * Get all content for client's site
   */
  async getContent(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = getSiteId(req)
      const content = await contentService.getContentWithDefaults(siteId)
      res.json(success(content))
    } catch (error) {
      next(error)
    }
  },

  /**
   * PUT /api/client/content
   * Update content for client's site
   */
  async updateContent(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = getSiteId(req)
      const data = req.body as Record<string, unknown>

      const content = await contentService.updateContent(siteId, data)
      res.json(success(content))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/client/collections
   * Get all collections for client's site
   */
  async getAllCollections(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = getSiteId(req)
      const collections = await collectionService.getAllCollections(siteId)
      res.json(success(collections))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/client/collections/:type
   * Get items of a specific collection type
   */
  async getCollectionItems(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = getSiteId(req)
      const type = req.params.type!
      const items = await collectionService.listItems(siteId, type)
      res.json(success(items))
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/client/collections/:type
   * Create a new collection item
   */
  async createCollectionItem(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = getSiteId(req)
      const type = req.params.type!
      const data = req.body as Record<string, unknown>

      const item = await collectionService.createItem(siteId, type, data)
      res.status(201).json(success(item))
    } catch (error) {
      next(error)
    }
  },

  /**
   * PUT /api/client/collections/:type/:id
   * Update a collection item
   */
  async updateCollectionItem(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id!
      const data = req.body as Record<string, unknown>

      const item = await collectionService.updateItem(id, data)
      res.json(success(item))
    } catch (error) {
      next(error)
    }
  },

  /**
   * DELETE /api/client/collections/:type/:id
   * Delete a collection item
   */
  async deleteCollectionItem(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id!
      await collectionService.deleteItem(id)
      res.json(success({ deleted: true }))
    } catch (error) {
      next(error)
    }
  },

  /**
   * PUT /api/client/collections/:type/reorder
   * Reorder collection items
   */
  async reorderCollectionItems(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = getSiteId(req)
      const type = req.params.type!
      const { itemIds } = req.body as { itemIds: string[] }

      if (!Array.isArray(itemIds)) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'itemIds doit être un tableau' },
        })
        return
      }

      const items = await collectionService.reorderItems(siteId, type, itemIds)
      res.json(success(items))
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/client/upload
   * Upload an image to Cloudinary
   */
  async uploadImage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw Errors.badRequest('Aucun fichier fourni')
      }

      const siteId = getSiteId(req)

      // Use site-specific folder
      const result = await cloudinaryService.uploadImage(req.file.buffer, {
        folder: `bifrost/${siteId}`,
      })

      res.json(success({
        publicId: result.publicId,
        url: result.secureUrl,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
      }))
    } catch (error) {
      next(error)
    }
  },
}
