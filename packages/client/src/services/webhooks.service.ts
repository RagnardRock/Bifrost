import { api } from './api'
import type { ApiResponse } from '@bifrost/shared'

export interface WebhookLog {
  id: string
  siteId: string
  status: string
  attempts: number
  lastAttempt: string | null
  responseCode: number | null
  errorMessage: string | null
  payload: {
    event: string
    siteId: string
    timestamp: string
    data: Record<string, unknown>
  }
  createdAt: string
}

export const webhooksService = {
  /**
   * Get webhook logs for a site
   */
  async getLogs(siteId: string, limit: number = 50): Promise<WebhookLog[]> {
    const response = await api.get<unknown, ApiResponse<WebhookLog[]>>(
      `/admin/sites/${siteId}/webhooks`,
      { params: { limit } }
    )
    return response.data
  },

  /**
   * Send a test webhook
   */
  async sendTest(siteId: string): Promise<void> {
    await api.post(`/admin/sites/${siteId}/webhooks/test`)
  },
}
