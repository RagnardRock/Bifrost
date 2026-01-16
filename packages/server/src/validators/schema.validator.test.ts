import { describe, it, expect } from 'vitest'
import {
  fieldTypeSchema,
  fieldDefinitionSchema,
  fieldGroupSchema,
  collectionDefinitionSchema,
  bifrostSchemaSchema,
} from './schema.validator'

describe('Schema Validators', () => {
  describe('fieldTypeSchema', () => {
    it('should accept valid field types', () => {
      const validTypes = ['text', 'richtext', 'image', 'date', 'number', 'boolean']

      for (const type of validTypes) {
        const result = fieldTypeSchema.safeParse(type)
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid field types', () => {
      const invalidTypes = ['string', 'textarea', 'file', 'email', 'url', 'password']

      for (const type of invalidTypes) {
        const result = fieldTypeSchema.safeParse(type)
        expect(result.success).toBe(false)
      }
    })
  })

  describe('fieldDefinitionSchema', () => {
    it('should accept valid field definition', () => {
      const field = {
        type: 'text',
        label: 'Title',
      }

      const result = fieldDefinitionSchema.safeParse(field)
      expect(result.success).toBe(true)
    })

    it('should accept field with optional properties', () => {
      const field = {
        type: 'text',
        label: 'Title',
        default: 'Default value',
        selector: '#title',
      }

      const result = fieldDefinitionSchema.safeParse(field)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(field)
    })

    it('should reject field without type', () => {
      const field = {
        label: 'Title',
      }

      const result = fieldDefinitionSchema.safeParse(field)
      expect(result.success).toBe(false)
    })

    it('should reject field without label', () => {
      const field = {
        type: 'text',
      }

      const result = fieldDefinitionSchema.safeParse(field)
      expect(result.success).toBe(false)
    })

    it('should reject field with empty label', () => {
      const field = {
        type: 'text',
        label: '',
      }

      const result = fieldDefinitionSchema.safeParse(field)
      expect(result.success).toBe(false)
    })

    it('should accept any default value type', () => {
      const defaults = [
        'string value',
        123,
        true,
        false,
        null,
        { nested: 'object' },
        ['array', 'of', 'values'],
      ]

      for (const defaultValue of defaults) {
        const field = {
          type: 'text',
          label: 'Field',
          default: defaultValue,
        }

        const result = fieldDefinitionSchema.safeParse(field)
        expect(result.success).toBe(true)
      }
    })
  })

  describe('fieldGroupSchema', () => {
    it('should accept valid group', () => {
      const group = {
        label: 'Hero Section',
        fields: ['title', 'subtitle'],
      }

      const result = fieldGroupSchema.safeParse(group)
      expect(result.success).toBe(true)
    })

    it('should reject group without label', () => {
      const group = {
        fields: ['title'],
      }

      const result = fieldGroupSchema.safeParse(group)
      expect(result.success).toBe(false)
    })

    it('should reject group with empty label', () => {
      const group = {
        label: '',
        fields: ['title'],
      }

      const result = fieldGroupSchema.safeParse(group)
      expect(result.success).toBe(false)
    })

    it('should reject group without fields', () => {
      const group = {
        label: 'Section',
      }

      const result = fieldGroupSchema.safeParse(group)
      expect(result.success).toBe(false)
    })

    it('should reject group with empty fields array', () => {
      const group = {
        label: 'Section',
        fields: [],
      }

      const result = fieldGroupSchema.safeParse(group)
      expect(result.success).toBe(false)
    })
  })

  describe('collectionDefinitionSchema', () => {
    it('should accept valid collection', () => {
      const collection = {
        label: 'Blog Posts',
        fields: {
          title: { type: 'text', label: 'Title' },
          content: { type: 'richtext', label: 'Content' },
        },
      }

      const result = collectionDefinitionSchema.safeParse(collection)
      expect(result.success).toBe(true)
    })

    it('should reject collection without label', () => {
      const collection = {
        fields: {
          title: { type: 'text', label: 'Title' },
        },
      }

      const result = collectionDefinitionSchema.safeParse(collection)
      expect(result.success).toBe(false)
    })

    it('should reject collection without fields', () => {
      const collection = {
        label: 'Posts',
      }

      const result = collectionDefinitionSchema.safeParse(collection)
      expect(result.success).toBe(false)
    })

    it('should reject collection with empty fields', () => {
      const collection = {
        label: 'Posts',
        fields: {},
      }

      const result = collectionDefinitionSchema.safeParse(collection)
      expect(result.success).toBe(false)
    })

    it('should validate nested field definitions', () => {
      const collection = {
        label: 'Posts',
        fields: {
          title: { type: 'invalid', label: 'Title' },
        },
      }

      const result = collectionDefinitionSchema.safeParse(collection)
      expect(result.success).toBe(false)
    })
  })

  describe('bifrostSchemaSchema', () => {
    it('should accept schema with only fields', () => {
      const schema = {
        fields: {
          title: { type: 'text', label: 'Title' },
        },
      }

      const result = bifrostSchemaSchema.safeParse(schema)
      expect(result.success).toBe(true)
    })

    it('should accept schema with only collections', () => {
      const schema = {
        collections: {
          posts: {
            label: 'Posts',
            fields: {
              title: { type: 'text', label: 'Title' },
            },
          },
        },
      }

      const result = bifrostSchemaSchema.safeParse(schema)
      expect(result.success).toBe(true)
    })

    it('should accept complete schema', () => {
      const schema = {
        groups: {
          hero: {
            label: 'Hero',
            fields: ['hero_title'],
          },
        },
        fields: {
          hero_title: { type: 'text', label: 'Title' },
        },
        collections: {
          posts: {
            label: 'Posts',
            fields: {
              title: { type: 'text', label: 'Title' },
            },
          },
        },
      }

      const result = bifrostSchemaSchema.safeParse(schema)
      expect(result.success).toBe(true)
    })

    it('should reject empty schema', () => {
      const schema = {}

      const result = bifrostSchemaSchema.safeParse(schema)
      expect(result.success).toBe(false)
    })

    it('should reject schema with only empty groups', () => {
      const schema = {
        groups: {},
        fields: {},
      }

      const result = bifrostSchemaSchema.safeParse(schema)
      expect(result.success).toBe(false)
    })

    it('should reject schema with group referencing non-existent field', () => {
      const schema = {
        groups: {
          hero: {
            label: 'Hero',
            fields: ['nonexistent'],
          },
        },
        fields: {
          title: { type: 'text', label: 'Title' },
        },
      }

      const result = bifrostSchemaSchema.safeParse(schema)
      expect(result.success).toBe(false)
    })

    it('should accept groups referencing existing fields', () => {
      const schema = {
        groups: {
          hero: {
            label: 'Hero',
            fields: ['title', 'subtitle'],
          },
        },
        fields: {
          title: { type: 'text', label: 'Title' },
          subtitle: { type: 'text', label: 'Subtitle' },
        },
      }

      const result = bifrostSchemaSchema.safeParse(schema)
      expect(result.success).toBe(true)
    })

    it('should accept schema without groups', () => {
      const schema = {
        fields: {
          title: { type: 'text', label: 'Title' },
        },
      }

      const result = bifrostSchemaSchema.safeParse(schema)
      expect(result.success).toBe(true)
    })
  })
})
