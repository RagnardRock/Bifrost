import { contentRepository } from '../repositories/content.repository'
import { siteRepository } from '../repositories/site.repository'
import { webhookService } from './webhook.service'
import { historyService } from './history.service'
import { Errors } from '../utils/errors'
import type { BifrostSchema } from '@bifrost/shared'

export type ContentData = Record<string, unknown>

export const contentService = {
  /**
   * Get all content for a site as a flat object
   */
  async getContent(siteId: string): Promise<ContentData> {
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    const contents = await contentRepository.findBySiteId(siteId)

    const result: ContentData = {}
    for (const content of contents) {
      result[content.fieldKey] = content.value
    }

    return result
  },

  /**
   * Get content for a single field
   */
  async getFieldContent(siteId: string, fieldKey: string): Promise<unknown> {
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    const content = await contentRepository.findByFieldKey(siteId, fieldKey)
    return content?.value ?? null
  },

  /**
   * Update content for multiple fields
   * Note: Schema is used for UI hints (labels, types) but doesn't restrict which fields can be saved
   */
  async updateContent(siteId: string, data: ContentData, changedBy?: string): Promise<ContentData> {
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    // Schema is informational only - we allow saving any field
    // This gives flexibility for sites that don't want strict schema validation

    // Get current values for history
    const currentContent = await this.getContent(siteId)

    // Record history for each changed field
    for (const [fieldKey, newValue] of Object.entries(data)) {
      const oldValue = currentContent[fieldKey]
      historyService.recordFieldChange(siteId, fieldKey, oldValue, newValue, changedBy).catch(() => {})
    }

    // Upsert all content
    await contentRepository.upsertMany(siteId, data)

    // Trigger webhook
    webhookService.queueWebhook(siteId, 'content.updated', {
      changes: data,
    }).catch(() => {}) // Don't fail if webhook fails

    // Return updated content
    return this.getContent(siteId)
  },

  /**
   * Update a single field's content
   */
  async updateFieldContent(
    siteId: string,
    fieldKey: string,
    value: unknown
  ): Promise<unknown> {
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    // Schema is informational only - we allow saving any field

    const content = await contentRepository.upsert({
      siteId,
      fieldKey,
      value,
    })

    return content.value
  },

  /**
   * Delete content for a field
   */
  async deleteFieldContent(siteId: string, fieldKey: string): Promise<void> {
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    await contentRepository.delete(siteId, fieldKey)

    // Trigger webhook
    webhookService.queueWebhook(siteId, 'content.deleted', {
      fieldKey,
    }).catch(() => {})
  },

  /**
   * Get content with schema defaults applied
   */
  async getContentWithDefaults(siteId: string): Promise<ContentData> {
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    const content = await this.getContent(siteId)

    // Apply defaults from schema
    if (site.schema) {
      const schema = site.schema as BifrostSchema
      const schemaFields = schema.fields || {}

      for (const [fieldKey, definition] of Object.entries(schemaFields)) {
        if (content[fieldKey] === undefined && definition.default !== undefined) {
          content[fieldKey] = definition.default
        }
      }
    }

    return content
  },
}
