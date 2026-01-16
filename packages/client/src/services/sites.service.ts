import { api } from './api'
import type { Site, SiteCreateInput, ApiResponse } from '@bifrost/shared'

export const sitesService = {
  async list(): Promise<Site[]> {
    const response = await api.get<unknown, ApiResponse<Site[]>>('/admin/sites')
    return response.data
  },

  async getById(id: string): Promise<Site> {
    const response = await api.get<unknown, ApiResponse<Site>>(`/admin/sites/${id}`)
    return response.data
  },

  async create(input: SiteCreateInput): Promise<Site> {
    const response = await api.post<unknown, ApiResponse<Site>>('/admin/sites', input)
    return response.data
  },

  async update(id: string, input: Partial<SiteCreateInput>): Promise<Site> {
    const response = await api.put<unknown, ApiResponse<Site>>(`/admin/sites/${id}`, input)
    return response.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/admin/sites/${id}`)
  },

  async regenerateApiKey(id: string): Promise<Site> {
    const response = await api.post<unknown, ApiResponse<Site>>(
      `/admin/sites/${id}/regenerate-key`
    )
    return response.data
  },
}
