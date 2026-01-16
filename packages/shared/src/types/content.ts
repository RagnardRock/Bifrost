import type { CollectionItemData } from './collection'

/**
 * Content stores the current value of a field for a site
 */
export interface Content {
  id: string
  siteId: string
  fieldKey: string
  value: ContentValue
  version: number
  updatedAt: Date
  updatedBy: string | null
}

/**
 * Flexible content value types
 */
export type ContentValue = string | number | boolean | Date | ImageValue | null

export interface ImageValue {
  url: string
  publicId: string
  alt?: string
}

export interface ContentUpdateInput {
  fieldKey: string
  value: ContentValue
}

export interface ContentBatchUpdateInput {
  updates: ContentUpdateInput[]
}

/**
 * API response with complete site content
 */
export interface SiteContentResponse {
  fields: Record<string, ContentValue>
  collections: Record<string, CollectionItemData[]>
}
