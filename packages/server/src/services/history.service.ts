import { historyRepository } from '../repositories/history.repository'
import { contentRepository } from '../repositories/content.repository'
import { collectionRepository } from '../repositories/collection.repository'
import { Errors } from '../utils/errors'
import type { ContentHistory } from '@prisma/client'

export type HistoryEntry = ContentHistory & {
  user?: { email: string } | null
}

export const historyService = {
  /**
   * Record a content field change
   */
  async recordFieldChange(
    siteId: string,
    fieldKey: string,
    oldValue: unknown,
    newValue: unknown,
    changedBy?: string
  ): Promise<void> {
    // Only record if values are different
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
      return
    }

    await historyRepository.create({
      siteId,
      fieldKey,
      oldValue,
      newValue,
      changedBy,
    })
  },

  /**
   * Record a collection item change
   */
  async recordItemChange(
    siteId: string,
    itemId: string,
    oldValue: unknown,
    newValue: unknown,
    changedBy?: string
  ): Promise<void> {
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
      return
    }

    await historyRepository.create({
      siteId,
      itemId,
      oldValue,
      newValue,
      changedBy,
    })
  },

  /**
   * Get history for a site
   */
  async getSiteHistory(siteId: string, limit: number = 50): Promise<HistoryEntry[]> {
    return historyRepository.findBySiteId(siteId, limit)
  },

  /**
   * Get history for a specific field
   */
  async getFieldHistory(
    siteId: string,
    fieldKey: string,
    limit: number = 20
  ): Promise<HistoryEntry[]> {
    return historyRepository.findByFieldKey(siteId, fieldKey, limit)
  },

  /**
   * Get history for a collection item
   */
  async getItemHistory(itemId: string, limit: number = 20): Promise<HistoryEntry[]> {
    return historyRepository.findByItemId(itemId, limit)
  },

  /**
   * Restore a field to a previous value
   */
  async restoreField(
    siteId: string,
    historyId: string,
    restoredBy?: string
  ): Promise<unknown> {
    const history = await historyRepository.findById(historyId)

    if (!history) {
      throw Errors.notFound('Historique')
    }

    if (history.siteId !== siteId) {
      throw Errors.forbidden('Acces non autorise')
    }

    if (!history.fieldKey) {
      throw Errors.badRequest('Cet historique ne concerne pas un champ')
    }

    // Get current value for history
    const current = await contentRepository.findByFieldKey(siteId, history.fieldKey)
    const currentValue = current?.value

    // Restore the old value (which is the value we want to go back to)
    const valueToRestore = history.oldValue ?? history.newValue

    await contentRepository.upsert({
      siteId,
      fieldKey: history.fieldKey,
      value: valueToRestore,
    })

    // Record this restoration in history
    await historyRepository.create({
      siteId,
      fieldKey: history.fieldKey,
      oldValue: currentValue,
      newValue: valueToRestore,
      changedBy: restoredBy,
    })

    return valueToRestore
  },

  /**
   * Restore a collection item to a previous state
   */
  async restoreItem(
    historyId: string,
    restoredBy?: string
  ): Promise<Record<string, unknown>> {
    const history = await historyRepository.findById(historyId)

    if (!history) {
      throw Errors.notFound('Historique')
    }

    if (!history.itemId) {
      throw Errors.badRequest('Cet historique ne concerne pas un element de collection')
    }

    // Get current item
    const item = await collectionRepository.findById(history.itemId)

    if (!item) {
      throw Errors.notFound('Element')
    }

    const currentData = item.data as Record<string, unknown>
    const dataToRestore = (history.oldValue ?? history.newValue) as Record<string, unknown>

    // Update item with restored data
    await collectionRepository.update(history.itemId, { data: dataToRestore })

    // Record this restoration in history
    await historyRepository.create({
      siteId: history.siteId,
      itemId: history.itemId,
      oldValue: currentData,
      newValue: dataToRestore,
      changedBy: restoredBy,
    })

    return dataToRestore
  },

  /**
   * Get a specific history entry
   */
  async getHistoryEntry(id: string): Promise<HistoryEntry | null> {
    return historyRepository.findById(id)
  },

  /**
   * Clean up old history entries
   */
  async cleanup(siteId: string, keepLast: number = 100): Promise<number> {
    return historyRepository.deleteOld(siteId, keepLast)
  },
}
