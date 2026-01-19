import type { Request, Response, NextFunction } from 'express'
import { historyService } from '../services/history.service'
import { success } from '../utils/response'

export const historyController = {
  /**
   * GET /api/admin/sites/:siteId/history
   * Get all history for a site
   */
  async getSiteHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = req.params.siteId!
      const limit = parseInt(req.query.limit as string) || 50

      const history = await historyService.getSiteHistory(siteId, limit)

      res.json(success(history))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/admin/sites/:siteId/history/field/:fieldKey
   * Get history for a specific field
   */
  async getFieldHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = req.params.siteId!
      const fieldKey = req.params.fieldKey!
      const limit = parseInt(req.query.limit as string) || 20

      const history = await historyService.getFieldHistory(siteId, fieldKey, limit)

      res.json(success(history))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/admin/sites/:siteId/history/item/:itemId
   * Get history for a collection item
   */
  async getItemHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const itemId = req.params.itemId!
      const limit = parseInt(req.query.limit as string) || 20

      const history = await historyService.getItemHistory(itemId, limit)

      res.json(success(history))
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/admin/sites/:siteId/history/:historyId/restore
   * Restore a field or item to a previous state
   */
  async restore(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = req.params.siteId!
      const historyId = req.params.historyId!
      // Only use userId, not adminId (ContentHistory.changedBy references User table)
      const userId = req.user?.userId || undefined

      const entry = await historyService.getHistoryEntry(historyId)

      if (!entry) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Historique non trouve' },
        })
        return
      }

      let restored: unknown

      if (entry.fieldKey) {
        restored = await historyService.restoreField(siteId, historyId, userId)
      } else if (entry.itemId) {
        restored = await historyService.restoreItem(historyId, userId)
      } else {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Type d\'historique non supporte' },
        })
        return
      }

      res.json(success({ restored, message: 'Restauration effectuee' }))
    } catch (error) {
      next(error)
    }
  },
}
