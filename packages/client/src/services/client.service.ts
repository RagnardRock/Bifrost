import { api } from './api'
import type { ApiResponse, BifrostSchema, CollectionItemResponse } from '@bifrost/shared'

interface SiteInfo {
  id: string
  name: string
  domain: string
  schema: BifrostSchema | null
}

type ContentData = Record<string, unknown>

export const clientService = {
  /**
   * Get client's site info
   */
  async getSite(): Promise<SiteInfo> {
    const response = await api.get<unknown, ApiResponse<SiteInfo>>('/client/site')
    return response.data
  },

  /**
   * Get all content for client's site
   */
  async getContent(): Promise<ContentData> {
    const response = await api.get<unknown, ApiResponse<ContentData>>('/client/content')
    return response.data
  },

  /**
   * Update content for client's site
   */
  async updateContent(data: ContentData): Promise<ContentData> {
    const response = await api.put<unknown, ApiResponse<ContentData>>('/client/content', data)
    return response.data
  },

  /**
   * Get all collections for client's site
   */
  async getAllCollections(): Promise<Record<string, CollectionItemResponse[]>> {
    const response = await api.get<unknown, ApiResponse<Record<string, CollectionItemResponse[]>>>(
      '/client/collections'
    )
    return response.data
  },

  /**
   * Get items of a specific collection
   */
  async getCollectionItems(collectionType: string): Promise<CollectionItemResponse[]> {
    const response = await api.get<unknown, ApiResponse<CollectionItemResponse[]>>(
      `/client/collections/${collectionType}`
    )
    return response.data
  },

  /**
   * Create a new collection item
   */
  async createCollectionItem(
    collectionType: string,
    data: Record<string, unknown>
  ): Promise<CollectionItemResponse> {
    const response = await api.post<unknown, ApiResponse<CollectionItemResponse>>(
      `/client/collections/${collectionType}`,
      data
    )
    return response.data
  },

  /**
   * Update a collection item
   */
  async updateCollectionItem(
    collectionType: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<CollectionItemResponse> {
    const response = await api.put<unknown, ApiResponse<CollectionItemResponse>>(
      `/client/collections/${collectionType}/${id}`,
      data
    )
    return response.data
  },

  /**
   * Delete a collection item
   */
  async deleteCollectionItem(collectionType: string, id: string): Promise<void> {
    await api.delete(`/client/collections/${collectionType}/${id}`)
  },

  /**
   * Reorder collection items
   */
  async reorderCollectionItems(
    collectionType: string,
    itemIds: string[]
  ): Promise<CollectionItemResponse[]> {
    const response = await api.put<unknown, ApiResponse<CollectionItemResponse[]>>(
      `/client/collections/${collectionType}/reorder`,
      { itemIds }
    )
    return response.data
  },
}
