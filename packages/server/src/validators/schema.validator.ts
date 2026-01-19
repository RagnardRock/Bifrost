import { z } from 'zod'

// Field types supported by Bifrost
export const fieldTypeSchema = z.enum([
  'text',
  'richtext',
  'image',
  'date',
  'number',
  'boolean',
])

// Field definition schema
export const fieldDefinitionSchema = z.object({
  type: fieldTypeSchema,
  label: z.string().min(1, 'Le label est requis'),
  default: z.unknown().optional(),
  selector: z.string().optional(),
})

// Field group schema
export const fieldGroupSchema = z.object({
  label: z.string().min(1, 'Le label est requis'),
  fields: z.array(z.string()).min(1, 'Au moins un champ est requis'),
})

// Collection definition schema
export const collectionDefinitionSchema = z.object({
  label: z.string().min(1, 'Le label est requis'),
  fields: z.record(z.string(), fieldDefinitionSchema).refine(
    (fields) => Object.keys(fields).length > 0,
    'Au moins un champ est requis dans la collection'
  ),
})

// Complete Bifrost schema
export const bifrostSchemaSchema = z
  .object({
    groups: z.record(z.string(), fieldGroupSchema).optional(),
    fields: z.record(z.string(), fieldDefinitionSchema).optional(),
    collections: z.record(z.string(), collectionDefinitionSchema).optional(),
  })
  .refine(
    (schema) => {
      // At least one of fields or collections must be defined
      const hasFields = schema.fields && Object.keys(schema.fields).length > 0
      const hasCollections = schema.collections && Object.keys(schema.collections).length > 0
      return hasFields || hasCollections
    },
    'Le schéma doit définir au moins un champ ou une collection'
  )
  .refine(
    (schema) => {
      // Validate that group fields reference existing fields
      if (!schema.groups || !schema.fields) return true

      for (const [_groupKey, group] of Object.entries(schema.groups)) {
        for (const fieldKey of group.fields) {
          if (!schema.fields[fieldKey]) {
            return false
          }
        }
      }
      return true
    },
    'Les groupes référencent des champs inexistants'
  )

export type BifrostSchemaInput = z.infer<typeof bifrostSchemaSchema>
