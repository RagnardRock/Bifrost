import { api } from './api'
import type { BifrostSchema, ApiResponse } from '@bifrost/shared'

export interface SchemaValidationResult {
  valid: boolean
  schema?: BifrostSchema
  errors?: string[]
}

export interface SchemaUpdateResult {
  schema: BifrostSchema
  yaml: string
}

export const schemaService = {
  async getSchema(siteId: string): Promise<{ yaml: string | null }> {
    const response = await api.get<unknown, ApiResponse<{ yaml: string | null }>>(
      `/admin/sites/${siteId}/schema`
    )
    return response.data
  },

  async updateSchema(siteId: string, yaml: string): Promise<SchemaUpdateResult> {
    const response = await api.put<unknown, ApiResponse<SchemaUpdateResult>>(
      `/admin/sites/${siteId}/schema`,
      { yaml }
    )
    return response.data
  },

  async clearSchema(siteId: string): Promise<void> {
    await api.delete(`/admin/sites/${siteId}/schema`)
  },

  async validateSchema(siteId: string, yaml: string): Promise<SchemaValidationResult> {
    const response = await api.post<unknown, ApiResponse<SchemaValidationResult>>(
      `/admin/sites/${siteId}/schema/validate`,
      { yaml }
    )
    return response.data
  },

  async getExample(): Promise<{ yaml: string }> {
    const response = await api.get<unknown, ApiResponse<{ yaml: string }>>(
      '/admin/schema/example'
    )
    return response.data
  },
}
