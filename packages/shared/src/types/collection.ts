import type { ContentValue } from './content'

/**
 * CollectionItem stores an item in a collection (blog post, slide, etc.)
 */
export interface CollectionItem {
  id: string
  siteId: string
  collectionType: string
  data: Record<string, ContentValue>
  position: number
  createdAt: Date
  updatedAt: Date
}

export interface CollectionItemCreateInput {
  collectionType: string
  data: Record<string, ContentValue>
}

export interface CollectionItemUpdateInput {
  data: Record<string, ContentValue>
}

export interface CollectionReorderInput {
  itemIds: string[]
}

/**
 * Collection item data for frontend display (without siteId)
 */
export type CollectionItemData = Omit<CollectionItem, 'siteId'>
