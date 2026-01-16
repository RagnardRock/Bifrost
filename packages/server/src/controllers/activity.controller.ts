import { Request, Response, NextFunction } from 'express'
import { activityService, type ActivityFilters } from '../services/activity.service'

export const activityController = {
  /**
   * Get activity across all sites
   * GET /api/admin/activity
   */
  async getActivity(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        siteId,
        type,
        startDate,
        endDate,
        limit = '50',
        offset = '0',
      } = req.query

      const filters: ActivityFilters = {}

      if (siteId && typeof siteId === 'string') {
        filters.siteId = siteId
      }

      if (type && typeof type === 'string') {
        filters.type = type as ActivityFilters['type']
      }

      if (startDate && typeof startDate === 'string') {
        filters.startDate = new Date(startDate)
      }

      if (endDate && typeof endDate === 'string') {
        filters.endDate = new Date(endDate)
      }

      const result = await activityService.getActivity(
        filters,
        parseInt(limit as string, 10),
        parseInt(offset as string, 10)
      )

      res.json({
        success: true,
        data: result.entries,
        pagination: {
          total: result.total,
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10),
        },
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * Get activity summary for a site
   * GET /api/admin/sites/:siteId/activity
   */
  async getSiteActivity(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { siteId } = req.params
      const summary = await activityService.getSiteActivitySummary(siteId)

      res.json({
        success: true,
        data: summary,
      })
    } catch (error) {
      next(error)
    }
  },
}
