import type { Request, Response, NextFunction } from 'express'
import { contentService } from '../services/content.service'
import { success } from '../utils/response'

export const contentController = {
  /**
   * GET /api/admin/sites/:siteId/content
   * Get all content for a site
   */
  async getContent(req: Request, res: Response, next: NextFunction) {
    try {
      const { siteId } = req.params
      const content = await contentService.getContentWithDefaults(siteId)
      res.json(success(content))
    } catch (error) {
      next(error)
    }
  },

  /**
   * PUT /api/admin/sites/:siteId/content
   * Update content for multiple fields
   */
  async updateContent(req: Request, res: Response, next: NextFunction) {
    try {
      const { siteId } = req.params
      const data = req.body as Record<string, unknown>

      const content = await contentService.updateContent(siteId, data)
      res.json(success(content))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/admin/sites/:siteId/content/:fieldKey
   * Get content for a single field
   */
  async getFieldContent(req: Request, res: Response, next: NextFunction) {
    try {
      const { siteId, fieldKey } = req.params
      const value = await contentService.getFieldContent(siteId, fieldKey)
      res.json(success({ fieldKey, value }))
    } catch (error) {
      next(error)
    }
  },

  /**
   * PUT /api/admin/sites/:siteId/content/:fieldKey
   * Update content for a single field
   */
  async updateFieldContent(req: Request, res: Response, next: NextFunction) {
    try {
      const { siteId, fieldKey } = req.params
      const { value } = req.body as { value: unknown }

      const updatedValue = await contentService.updateFieldContent(siteId, fieldKey, value)
      res.json(success({ fieldKey, value: updatedValue }))
    } catch (error) {
      next(error)
    }
  },

  /**
   * DELETE /api/admin/sites/:siteId/content/:fieldKey
   * Delete content for a field
   */
  async deleteFieldContent(req: Request, res: Response, next: NextFunction) {
    try {
      const { siteId, fieldKey } = req.params
      await contentService.deleteFieldContent(siteId, fieldKey)
      res.json(success({ deleted: true }))
    } catch (error) {
      next(error)
    }
  },
}
