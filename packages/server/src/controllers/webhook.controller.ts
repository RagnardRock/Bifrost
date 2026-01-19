import type { Request, Response, NextFunction } from 'express'
import { webhookService } from '../services/webhook.service'
import { success } from '../utils/response'

export const webhookController = {
  /**
   * GET /api/admin/sites/:siteId/webhooks
   * Get webhook logs for a site
   */
  async getLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = req.params.siteId!
      const limit = parseInt(req.query.limit as string) || 50

      const logs = await webhookService.getLogs(siteId, limit)

      res.json(success(logs))
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/admin/sites/:siteId/webhooks/test
   * Send a test webhook to verify configuration
   */
  async sendTest(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = req.params.siteId!

      await webhookService.queueWebhook(siteId, 'content.updated', {
        fieldKey: '_test',
        changes: { _test: true },
      })

      res.json(success({ message: 'Webhook de test envoye' }))
    } catch (error) {
      next(error)
    }
  },
}
