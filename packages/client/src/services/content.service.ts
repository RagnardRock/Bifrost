import { api } from './api'
import type { ApiResponse } from '@bifrost/shared'

export type ContentData = Record<string, unknown>

export const contentService = {
  async getContent(siteId: string): Promise<ContentData> {
    const response = await api.get<unknown, ApiResponse<ContentData>>(
      `/admin/sites/${siteId}/content`
    )
    return response.data
  },

  async updateContent(siteId: string, data: ContentData): Promise<ContentData> {
    const response = await api.put<unknown, ApiResponse<ContentData>>(
      `/admin/sites/${siteId}/content`,
      data
    )
    return response.data
  },

  async getFieldContent(siteId: string, fieldKey: string): Promise<unknown> {
    const response = await api.get<unknown, ApiResponse<{ value: unknown }>>(
      `/admin/sites/${siteId}/content/${fieldKey}`
    )
    return response.data.value
  },

  async updateFieldContent(
    siteId: string,
    fieldKey: string,
    value: unknown
  ): Promise<unknown> {
    const response = await api.put<unknown, ApiResponse<{ value: unknown }>>(
      `/admin/sites/${siteId}/content/${fieldKey}`,
      { value }
    )
    return response.data.value
  },

  async deleteFieldContent(siteId: string, fieldKey: string): Promise<void> {
    await api.delete(`/admin/sites/${siteId}/content/${fieldKey}`)
  },
}
