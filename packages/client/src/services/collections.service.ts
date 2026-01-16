import { api } from './api'
import type { ApiResponse } from '@bifrost/shared'

export interface CollectionItem {
  id: string
  collectionType: string
  data: Record<string, unknown>
  position: number
  createdAt: Date
  updatedAt: Date
}

export type CollectionsData = Record<string, CollectionItem[]>

export const collectionsService = {
  async getAllCollections(siteId: string): Promise<CollectionsData> {
    const response = await api.get<unknown, ApiResponse<CollectionsData>>(
      `/admin/sites/${siteId}/collections`
    )
    return response.data
  },

  async listItems(siteId: string, collectionType: string): Promise<CollectionItem[]> {
    const response = await api.get<unknown, ApiResponse<CollectionItem[]>>(
      `/admin/sites/${siteId}/collections/${collectionType}`
    )
    return response.data
  },

  async createItem(
    siteId: string,
    collectionType: string,
    data: Record<string, unknown>
  ): Promise<CollectionItem> {
    const response = await api.post<unknown, ApiResponse<CollectionItem>>(
      `/admin/sites/${siteId}/collections/${collectionType}`,
      data
    )
    return response.data
  },

  async getItem(
    siteId: string,
    collectionType: string,
    itemId: string
  ): Promise<CollectionItem> {
    const response = await api.get<unknown, ApiResponse<CollectionItem>>(
      `/admin/sites/${siteId}/collections/${collectionType}/${itemId}`
    )
    return response.data
  },

  async updateItem(
    siteId: string,
    collectionType: string,
    itemId: string,
    data: Record<string, unknown>
  ): Promise<CollectionItem> {
    const response = await api.put<unknown, ApiResponse<CollectionItem>>(
      `/admin/sites/${siteId}/collections/${collectionType}/${itemId}`,
      data
    )
    return response.data
  },

  async deleteItem(
    siteId: string,
    collectionType: string,
    itemId: string
  ): Promise<void> {
    await api.delete(`/admin/sites/${siteId}/collections/${collectionType}/${itemId}`)
  },

  async reorderItems(
    siteId: string,
    collectionType: string,
    itemIds: string[]
  ): Promise<CollectionItem[]> {
    const response = await api.put<unknown, ApiResponse<CollectionItem[]>>(
      `/admin/sites/${siteId}/collections/${collectionType}/reorder`,
      { itemIds }
    )
    return response.data
  },
}
