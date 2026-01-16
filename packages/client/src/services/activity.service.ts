import { api } from './api'
import type { ApiResponse } from '@bifrost/shared'

export interface ActivityEntry {
  id: string
  siteId: string
  siteName: string
  siteUrl: string
  type: 'field_update' | 'item_create' | 'item_update' | 'item_delete'
  fieldKey: string | null
  itemId: string | null
  collectionType: string | null
  changedAt: string
  changedBy: string | null
  userEmail: string | null
  summary: string
}

export interface ActivityFilters {
  siteId?: string
  type?: 'field_update' | 'item_create' | 'item_update' | 'item_delete'
  startDate?: string
  endDate?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    limit: number
    offset: number
  }
}

export interface SiteActivitySummary {
  recentChanges: number
  activeUsers: number
  recentActivity: Array<{
    id: string
    fieldKey: string | null
    itemId: string | null
    changedAt: string
    userEmail: string | null
  }>
}

export const activityService = {
  /**
   * Get activity across all sites
   */
  async getActivity(
    filters: ActivityFilters = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<PaginatedResponse<ActivityEntry>> {
    const params = new URLSearchParams()

    if (filters.siteId) params.append('siteId', filters.siteId)
    if (filters.type) params.append('type', filters.type)
    if (filters.startDate) params.append('startDate', filters.startDate)
    if (filters.endDate) params.append('endDate', filters.endDate)
    params.append('limit', limit.toString())
    params.append('offset', offset.toString())

    const response = await api.get<unknown, ApiResponse<ActivityEntry[]> & { pagination: { total: number; limit: number; offset: number } }>(
      `/admin/activity?${params.toString()}`
    )

    return {
      data: response.data,
      pagination: response.pagination,
    }
  },

  /**
   * Get activity summary for a specific site
   */
  async getSiteActivity(siteId: string): Promise<SiteActivitySummary> {
    const response = await api.get<unknown, ApiResponse<SiteActivitySummary>>(
      `/admin/sites/${siteId}/activity`
    )
    return response.data
  },
}
