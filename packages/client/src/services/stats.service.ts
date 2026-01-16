import { api } from './api'
import type { ApiResponse } from '@bifrost/shared'

export interface DashboardStats {
  sites: {
    total: number
    withSchema: number
    withWebhook: number
  }
  users: {
    total: number
    admins: number
    clients: number
  }
  content: {
    totalFields: number
    totalCollectionItems: number
  }
  activity: {
    recentChanges: number
    webhooksSent: number
    webhooksSuccess: number
    webhooksFailed: number
  }
  recentSites: Array<{
    id: string
    name: string
    url: string
    createdAt: string
    usersCount: number
  }>
}

export interface SiteStats {
  users: number
  contentFields: number
  collectionItems: number
  recentChanges: number
  webhookLogs: number
}

export const statsService = {
  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await api.get<unknown, ApiResponse<DashboardStats>>(
      '/admin/stats'
    )
    return response.data
  },

  /**
   * Get stats for a specific site
   */
  async getSiteStats(siteId: string): Promise<SiteStats> {
    const response = await api.get<unknown, ApiResponse<SiteStats>>(
      `/admin/sites/${siteId}/stats`
    )
    return response.data
  },
}
