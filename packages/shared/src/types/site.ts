/**
 * Site represents a client website managed in Bifrost
 */
export interface Site {
  id: string
  name: string
  url: string
  apiKey: string
  schema: BifrostSchema | null
  webhookUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface SiteCreateInput {
  name: string
  url: string
  webhookUrl?: string
  schemaYaml?: string
}

export interface SiteUpdateInput {
  name?: string
  url?: string
  webhookUrl?: string | null
  schemaYaml?: string
}

/**
 * Bifrost Schema - parsed from YAML
 */
export interface BifrostSchema {
  groups?: Record<string, FieldGroup>
  fields?: Record<string, FieldDefinition>
  collections?: Record<string, CollectionDefinition>
}

export interface FieldGroup {
  label: string
  fields: string[]
}

export type FieldType = 'text' | 'richtext' | 'image' | 'date' | 'number' | 'boolean'

export interface FieldDefinition {
  type: FieldType
  label: string
  default?: unknown
  selector?: string
}

export interface CollectionDefinition {
  label: string
  fields: Record<string, FieldDefinition>
}
