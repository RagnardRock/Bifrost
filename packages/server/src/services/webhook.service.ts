import { webhookRepository } from '../repositories/webhook.repository'
import { siteRepository } from '../repositories/site.repository'
import { config } from '../config'
import { logger } from '../utils/logger'
import { WEBHOOK_RETRY_DELAYS } from '@bifrost/shared'
import crypto from 'crypto'

export type WebhookEvent =
  | 'content.updated'
  | 'content.deleted'
  | 'collection.created'
  | 'collection.updated'
  | 'collection.deleted'
  | 'collection.reordered'

export interface WebhookPayload {
  event: WebhookEvent
  siteId: string
  timestamp: string
  data: {
    fieldKey?: string
    collectionType?: string
    itemId?: string
    changes?: Record<string, unknown>
  }
}

export const webhookService = {
  /**
   * Queue a webhook notification for a site
   */
  async queueWebhook(siteId: string, event: WebhookEvent, data: WebhookPayload['data']): Promise<void> {
    const site = await siteRepository.findById(siteId)

    if (!site?.webhookUrl) {
      logger.debug({ siteId, event }, 'No webhook URL configured, skipping')
      return
    }

    const payload: WebhookPayload = {
      event,
      siteId,
      timestamp: new Date().toISOString(),
      data,
    }

    // Create log entry
    const log = await webhookRepository.create({
      siteId,
      payload,
    })

    // Try to send immediately
    await this.sendWebhook(log.id, site.webhookUrl, payload)
  },

  /**
   * Send a webhook with signature
   */
  async sendWebhook(logId: string, webhookUrl: string, payload: WebhookPayload): Promise<boolean> {
    const log = await webhookRepository.findById(logId)
    if (!log) return false

    const attempts = log.attempts + 1
    const payloadString = JSON.stringify(payload)

    // Generate HMAC signature
    const signature = crypto
      .createHmac('sha256', config.webhookSecret)
      .update(payloadString)
      .digest('hex')

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bifrost-Signature': signature,
          'X-Bifrost-Event': payload.event,
          'X-Bifrost-Timestamp': payload.timestamp,
        },
        body: payloadString,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (response.ok) {
        await webhookRepository.update(logId, {
          status: 'success',
          attempts,
          lastAttempt: new Date(),
          responseCode: response.status,
          errorMessage: null,
        })
        logger.info({ logId, event: payload.event }, 'Webhook sent successfully')
        return true
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error'

      await webhookRepository.update(logId, {
        status: attempts >= 3 ? 'failed' : 'pending',
        attempts,
        lastAttempt: new Date(),
        responseCode: null,
        errorMessage,
      })

      logger.warn({ logId, attempts, error: errorMessage }, 'Webhook delivery failed')

      // Schedule retry if attempts remaining
      if (attempts < 3) {
        const delay = WEBHOOK_RETRY_DELAYS[attempts - 1] || 60000
        setTimeout(() => {
          this.retryWebhook(logId)
        }, delay)
      }

      return false
    }
  },

  /**
   * Retry a failed webhook
   */
  async retryWebhook(logId: string): Promise<void> {
    const log = await webhookRepository.findById(logId)
    if (!log || log.status === 'success' || log.attempts >= 3) return

    const site = await siteRepository.findById(log.siteId)
    if (!site?.webhookUrl) return

    await this.sendWebhook(logId, site.webhookUrl, log.payload as WebhookPayload)
  },

  /**
   * Process pending webhooks (for background job)
   */
  async processPendingWebhooks(): Promise<number> {
    const pending = await webhookRepository.findPending(10)
    let processed = 0

    for (const log of pending) {
      const site = (log as any).site
      if (site?.webhookUrl) {
        await this.sendWebhook(log.id, site.webhookUrl, log.payload as WebhookPayload)
        processed++
      }
    }

    return processed
  },

  /**
   * Get webhook logs for a site
   */
  async getLogs(siteId: string, limit: number = 50) {
    return webhookRepository.findBySiteId(siteId, limit)
  },

  /**
   * Clean up old webhook logs
   */
  async cleanup(daysOld: number = 30): Promise<number> {
    return webhookRepository.deleteOld(daysOld)
  },
}
