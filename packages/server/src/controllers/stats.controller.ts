import { Request, Response, NextFunction } from 'express'
import { statsService } from '../services/stats.service'

export const statsController = {
  /**
   * Get dashboard statistics
   * GET /api/admin/stats
   */
  async getDashboardStats(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await statsService.getDashboardStats()

      res.json({
        success: true,
        data: stats,
      })
    } catch (error) {
      next(error)
    }
  },

  /**
   * Get stats for a specific site
   * GET /api/admin/sites/:siteId/stats
   */
  async getSiteStats(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { siteId } = req.params
      const stats = await statsService.getSiteStats(siteId)

      res.json({
        success: true,
        data: stats,
      })
    } catch (error) {
      next(error)
    }
  },
}
