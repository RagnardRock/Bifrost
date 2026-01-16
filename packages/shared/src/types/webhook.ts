/**
 * WebhookLog tracks webhook delivery status
 */
export type WebhookStatus = 'pending' | 'success' | 'failed'

export interface WebhookLog {
  id: string
  siteId: string
  status: WebhookStatus
  attempts: number
  lastAttempt: Date | null
  responseCode: number | null
  errorMessage: string | null
}

/**
 * Webhook payload sent to client sites
 */
export interface WebhookPayload {
  event: 'content.updated'
  siteId: string
  timestamp: string
  changes: WebhookChange[]
}

export interface WebhookChange {
  type: 'field' | 'collection_item'
  key: string
  action: 'create' | 'update' | 'delete'
}
