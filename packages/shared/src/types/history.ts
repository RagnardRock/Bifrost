import type { ContentValue } from './content'

/**
 * ContentHistory tracks modifications for rollback
 */
export interface ContentHistory {
  id: string
  siteId: string
  fieldKey: string | null
  itemId: string | null
  oldValue: ContentValue | Record<string, ContentValue> | null
  newValue: ContentValue | Record<string, ContentValue>
  changedAt: Date
  changedBy: string | null
}

/**
 * History entry for display (with author email)
 */
export interface HistoryEntry {
  id: string
  fieldKey: string | null
  itemId: string | null
  oldValue: unknown
  newValue: unknown
  changedAt: Date
  changedByEmail?: string
}

export interface RollbackInput {
  historyId: string
}
