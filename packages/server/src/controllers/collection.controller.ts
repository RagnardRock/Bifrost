import type { Request, Response, NextFunction } from 'express'
import { collectionService } from '../services/collection.service'
import { success } from '../utils/response'

export const collectionController = {
  /**
   * GET /api/admin/sites/:siteId/collections
   * Get all collections with their items
   */
  async getAllCollections(req: Request, res: Response, next: NextFunction) {
    try {
      const { siteId } = req.params
      const collections = await collectionService.getAllCollections(siteId)
      res.json(success(collections))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/admin/sites/:siteId/collections/:type
   * List all items in a collection
   */
  async listItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { siteId, type } = req.params
      const items = await collectionService.listItems(siteId, type)
      res.json(success(items))
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/admin/sites/:siteId/collections/:type
   * Create a new collection item
   */
  async createItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { siteId, type } = req.params
      const data = req.body as Record<string, unknown>

      const item = await collectionService.createItem(siteId, type, data)
      res.status(201).json(success(item))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/admin/sites/:siteId/collections/:type/:id
   * Get a single collection item
   */
  async getItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const item = await collectionService.getItem(id)
      res.json(success(item))
    } catch (error) {
      next(error)
    }
  },

  /**
   * PUT /api/admin/sites/:siteId/collections/:type/:id
   * Update a collection item
   */
  async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const data = req.body as Record<string, unknown>

      const item = await collectionService.updateItem(id, data)
      res.json(success(item))
    } catch (error) {
      next(error)
    }
  },

  /**
   * DELETE /api/admin/sites/:siteId/collections/:type/:id
   * Delete a collection item
   */
  async deleteItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      await collectionService.deleteItem(id)
      res.json(success({ deleted: true }))
    } catch (error) {
      next(error)
    }
  },

  /**
   * PUT /api/admin/sites/:siteId/collections/:type/reorder
   * Reorder collection items
   */
  async reorderItems(req: Request, res: Response, next: NextFunction) {
    try {
      const { siteId, type } = req.params
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
}
