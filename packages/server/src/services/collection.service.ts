import { collectionRepository } from '../repositories/collection.repository'
import { siteRepository } from '../repositories/site.repository'
import { webhookService } from './webhook.service'
import { historyService } from './history.service'
import { Errors } from '../utils/errors'
import type { CollectionItem } from '@prisma/client'
import type { BifrostSchema, CollectionDefinition } from '@bifrost/shared'

export type CollectionItemResponse = {
  id: string
  collectionType: string
  data: Record<string, unknown>
  position: number
  createdAt: Date
  updatedAt: Date
}

function toItemResponse(item: CollectionItem): CollectionItemResponse {
  return {
    id: item.id,
    collectionType: item.collectionType,
    data: item.data as Record<string, unknown>,
    position: item.position,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export const collectionService = {
  /**
   * Get collection definition from schema
   */
  async getCollectionDefinition(
    siteId: string,
    collectionType: string
  ): Promise<CollectionDefinition | null> {
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    if (!site.schema) {
      return null
    }

    const schema = site.schema as BifrostSchema
    return schema.collections?.[collectionType] ?? null
  },

  /**
   * List all items in a collection
   */
  async listItems(siteId: string, collectionType: string): Promise<CollectionItemResponse[]> {
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    const items = await collectionRepository.findBySiteAndType(siteId, collectionType)
    return items.map(toItemResponse)
  },

  /**
   * Get a single collection item
   */
  async getItem(id: string): Promise<CollectionItemResponse> {
    const item = await collectionRepository.findById(id)
    if (!item) {
      throw Errors.notFound('Élément')
    }
    return toItemResponse(item)
  },

  /**
   * Create a new collection item
   */
  async createItem(
    siteId: string,
    collectionType: string,
    data: Record<string, unknown>
  ): Promise<CollectionItemResponse> {
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    // Validate collection exists in schema
    if (site.schema) {
      const schema = site.schema as BifrostSchema
      if (!schema.collections?.[collectionType]) {
        throw Errors.validation({
          collectionType: `La collection "${collectionType}" n'existe pas dans le schéma`,
        })
      }
    }

    const item = await collectionRepository.create({
      siteId,
      collectionType,
      data,
    })

    // Trigger webhook
    webhookService.queueWebhook(siteId, 'collection.created', {
      collectionType,
      itemId: item.id,
      changes: data,
    }).catch(() => {})

    return toItemResponse(item)
  },

  /**
   * Update a collection item
   */
  async updateItem(
    id: string,
    data: Record<string, unknown>,
    changedBy?: string
  ): Promise<CollectionItemResponse> {
    const existing = await collectionRepository.findById(id)
    if (!existing) {
      throw Errors.notFound('Élément')
    }

    // Record history
    const oldData = existing.data as Record<string, unknown>
    historyService.recordItemChange(existing.siteId, id, oldData, data, changedBy).catch(() => {})

    const item = await collectionRepository.update(id, { data })

    // Trigger webhook
    webhookService.queueWebhook(existing.siteId, 'collection.updated', {
      collectionType: existing.collectionType,
      itemId: id,
      changes: data,
    }).catch(() => {})

    return toItemResponse(item)
  },

  /**
   * Delete a collection item
   */
  async deleteItem(id: string): Promise<void> {
    const existing = await collectionRepository.findById(id)
    if (!existing) {
      throw Errors.notFound('Élément')
    }

    await collectionRepository.delete(id)

    // Trigger webhook
    webhookService.queueWebhook(existing.siteId, 'collection.deleted', {
      collectionType: existing.collectionType,
      itemId: id,
    }).catch(() => {})
  },

  /**
   * Reorder collection items
   */
  async reorderItems(
    siteId: string,
    collectionType: string,
    itemIds: string[]
  ): Promise<CollectionItemResponse[]> {
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    await collectionRepository.reorder(siteId, collectionType, itemIds)

    // Trigger webhook
    webhookService.queueWebhook(siteId, 'collection.reordered', {
      collectionType,
    }).catch(() => {})

    return this.listItems(siteId, collectionType)
  },

  /**
   * Get all collections for a site with their items
   */
  async getAllCollections(
    siteId: string
  ): Promise<Record<string, CollectionItemResponse[]>> {
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    const result: Record<string, CollectionItemResponse[]> = {}

    if (site.schema) {
      const schema = site.schema as BifrostSchema
      const collections = schema.collections || {}

      for (const collectionType of Object.keys(collections)) {
        const items = await collectionRepository.findBySiteAndType(siteId, collectionType)
        result[collectionType] = items.map(toItemResponse)
      }
    }

    return result
  },
}
