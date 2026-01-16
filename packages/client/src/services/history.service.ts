import { api } from './api'
import type { ApiResponse } from '@bifrost/shared'

export interface HistoryEntry {
  id: string
  siteId: string
  fieldKey: string | null
  itemId: string | null
  oldValue: unknown
  newValue: unknown
  changedAt: string
  changedBy: string | null
  user?: { email: string } | null
}

export const historyService = {
  /**
   * Get all history for a site
   */
  async getSiteHistory(siteId: string, limit: number = 50): Promise<HistoryEntry[]> {
    const response = await api.get<unknown, ApiResponse<HistoryEntry[]>>(
      `/admin/sites/${siteId}/history`,
      { params: { limit } }
    )
    return response.data
  },

  /**
   * Get history for a specific field
   */
  async getFieldHistory(siteId: string, fieldKey: string, limit: number = 20): Promise<HistoryEntry[]> {
    const response = await api.get<unknown, ApiResponse<HistoryEntry[]>>(
      `/admin/sites/${siteId}/history/field/${fieldKey}`,
      { params: { limit } }
    )
    return response.data
  },

  /**
   * Get history for a collection item
   */
  async getItemHistory(siteId: string, itemId: string, limit: number = 20): Promise<HistoryEntry[]> {
    const response = await api.get<unknown, ApiResponse<HistoryEntry[]>>(
      `/admin/sites/${siteId}/history/item/${itemId}`,
      { params: { limit } }
    )
    return response.data
  },

  /**
   * Restore to a previous state
   */
  async restore(siteId: string, historyId: string): Promise<{ restored: unknown; message: string }> {
    const response = await api.post<unknown, ApiResponse<{ restored: unknown; message: string }>>(
      `/admin/sites/${siteId}/history/${historyId}/restore`
    )
    return response.data
  },
}
