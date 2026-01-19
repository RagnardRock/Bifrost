import type { Request, Response, NextFunction } from 'express'
import { contentService } from '../services/content.service'
import { collectionService } from '../services/collection.service'
import { success } from '../utils/response'
import { Errors } from '../utils/errors'

/**
 * Get siteId from authenticated site (via API key)
 */
function getSiteId(req: Request): string {
  const siteId = req.site?.id
  if (!siteId) {
    throw Errors.unauthorized('Site non authentifie')
  }
  return siteId
}

export const publicController = {
  /**
   * GET /api/public/site
   * Get site info (for loader to get siteId and schema)
   */
  async getSiteInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const site = req.site
      if (!site) {
        throw Errors.unauthorized('Site non authentifie')
      }
      res.json(success({
        id: site.id,
        name: site.name,
        schema: site.schema,
      }))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/public/content
   * Get all content for the site
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
   * GET /api/public/content/:fieldKey
   * Get content for a specific field
   */
  async getFieldContent(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = getSiteId(req)
      const fieldKey = req.params.fieldKey!
      const value = await contentService.getFieldContent(siteId, fieldKey)
      res.json(success({ fieldKey, value }))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/public/collections
   * Get all collections with their items
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
   * GET /api/public/collections/:type
   * Get items of a specific collection
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
   * GET /api/public/collections/:type/:id
   * Get a specific collection item
   */
  async getCollectionItem(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id!
      const item = await collectionService.getItem(id)
      res.json(success(item))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/public/all
   * Get all content and collections in a single request
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = getSiteId(req)

      // Fetch content and collections in parallel
      const [content, collections] = await Promise.all([
        contentService.getContentWithDefaults(siteId),
        collectionService.getAllCollections(siteId),
      ])

      res.json(success({
        content,
        collections,
      }))
    } catch (error) {
      next(error)
    }
  },
}
