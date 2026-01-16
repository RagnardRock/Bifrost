import { describe, it, expect } from 'vitest'
import { schemaService } from './schema.service'

describe('schemaService', () => {
  describe('parseYaml', () => {
    it('should parse valid YAML', () => {
      const yaml = `
fields:
  title:
    type: text
    label: Title
`
      const result = schemaService.parseYaml(yaml)
      expect(result).toEqual({
        fields: {
          title: {
            type: 'text',
            label: 'Title',
          },
        },
      })
    })

    it('should throw on invalid YAML syntax', () => {
      const invalidYaml = `
fields:
  title: [
    unclosed bracket
`
      expect(() => schemaService.parseYaml(invalidYaml)).toThrow('Erreur de syntaxe YAML')
    })

    it('should handle empty string', () => {
      expect(schemaService.parseYaml('')).toBeUndefined()
    })
  })

  describe('validateSchema', () => {
    it('should validate a minimal valid schema with fields', () => {
      const schema = {
        fields: {
          title: {
            type: 'text',
            label: 'Title',
          },
        },
      }

      const result = schemaService.validateSchema(schema)
      expect(result.valid).toBe(true)
      expect(result.schema).toEqual(schema)
    })

    it('should validate a minimal valid schema with collections', () => {
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

      const result = schemaService.validateSchema(schema)
      expect(result.valid).toBe(true)
    })

    it('should validate a complete schema with groups, fields, and collections', () => {
      const schema = {
        groups: {
          hero: {
            label: 'Hero Section',
            fields: ['hero_title', 'hero_image'],
          },
        },
        fields: {
          hero_title: {
            type: 'text',
            label: 'Hero Title',
            selector: '#hero h1',
          },
          hero_image: {
            type: 'image',
            label: 'Hero Image',
          },
        },
        collections: {
          blog: {
            label: 'Blog Posts',
            fields: {
              title: { type: 'text', label: 'Title' },
              content: { type: 'richtext', label: 'Content' },
              date: { type: 'date', label: 'Date' },
            },
          },
        },
      }

      const result = schemaService.validateSchema(schema)
      expect(result.valid).toBe(true)
      expect(result.schema).toBeDefined()
    })

    it('should reject schema with no fields or collections', () => {
      const schema = {
        groups: {
          empty: { label: 'Empty', fields: [] },
        },
      }

      const result = schemaService.validateSchema(schema)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Le schéma doit définir au moins un champ ou une collection')
    })

    it('should reject empty schema', () => {
      const result = schemaService.validateSchema({})
      expect(result.valid).toBe(false)
    })

    it('should reject invalid field type', () => {
      const schema = {
        fields: {
          title: {
            type: 'invalid_type',
            label: 'Title',
          },
        },
      }

      const result = schemaService.validateSchema(schema)
      expect(result.valid).toBe(false)
      expect(result.errors?.some((e) => e.includes('type'))).toBe(true)
    })

    it('should validate all supported field types', () => {
      const types = ['text', 'richtext', 'image', 'date', 'number', 'boolean']

      for (const type of types) {
        const schema = {
          fields: {
            test_field: { type, label: `Test ${type}` },
          },
        }

        const result = schemaService.validateSchema(schema)
        expect(result.valid).toBe(true)
      }
    })

    it('should reject field without label', () => {
      const schema = {
        fields: {
          title: {
            type: 'text',
          },
        },
      }

      const result = schemaService.validateSchema(schema)
      expect(result.valid).toBe(false)
    })

    it('should reject group referencing non-existent field', () => {
      const schema = {
        groups: {
          hero: {
            label: 'Hero',
            fields: ['nonexistent_field'],
          },
        },
        fields: {
          title: { type: 'text', label: 'Title' },
        },
      }

      const result = schemaService.validateSchema(schema)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Les groupes référencent des champs inexistants')
    })

    it('should accept field with default value', () => {
      const schema = {
        fields: {
          title: {
            type: 'text',
            label: 'Title',
            default: 'Default Title',
          },
          count: {
            type: 'number',
            label: 'Count',
            default: 10,
          },
          active: {
            type: 'boolean',
            label: 'Active',
            default: true,
          },
        },
      }

      const result = schemaService.validateSchema(schema)
      expect(result.valid).toBe(true)
    })

    it('should reject collection without fields', () => {
      const schema = {
        collections: {
          empty: {
            label: 'Empty Collection',
            fields: {},
          },
        },
      }

      const result = schemaService.validateSchema(schema)
      expect(result.valid).toBe(false)
    })

    it('should reject group without fields array', () => {
      const schema = {
        groups: {
          hero: {
            label: 'Hero',
            fields: [],
          },
        },
        fields: {
          title: { type: 'text', label: 'Title' },
        },
      }

      const result = schemaService.validateSchema(schema)
      expect(result.valid).toBe(false)
    })
  })

  describe('parseAndValidate', () => {
    it('should parse and validate valid YAML schema', () => {
      const yaml = `
fields:
  title:
    type: text
    label: Title
  description:
    type: richtext
    label: Description
`
      const result = schemaService.parseAndValidate(yaml)
      expect(result.valid).toBe(true)
      expect(result.schema?.fields).toHaveProperty('title')
      expect(result.schema?.fields).toHaveProperty('description')
    })

    it('should return error for empty YAML', () => {
      const result = schemaService.parseAndValidate('')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Le schéma YAML est vide')
    })

    it('should return error for whitespace-only YAML', () => {
      const result = schemaService.parseAndValidate('   \n\t  ')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Le schéma YAML est vide')
    })

    it('should handle complete real-world schema', () => {
      const yaml = `
groups:
  hero:
    label: Section Hero
    fields:
      - hero_title
      - hero_subtitle
  about:
    label: À propos
    fields:
      - about_text

fields:
  hero_title:
    type: text
    label: Titre principal
    selector: "#hero h1"
    default: "Bienvenue"
  hero_subtitle:
    type: richtext
    label: Sous-titre
    selector: "#hero .subtitle"
  about_text:
    type: richtext
    label: Texte À propos
    selector: "#about p"

collections:
  blog_posts:
    label: Articles de blog
    fields:
      title:
        type: text
        label: Titre
      content:
        type: richtext
        label: Contenu
      image:
        type: image
        label: Image
      published:
        type: boolean
        label: Publié
      date:
        type: date
        label: Date de publication

  team:
    label: Équipe
    fields:
      name:
        type: text
        label: Nom
      role:
        type: text
        label: Rôle
      photo:
        type: image
        label: Photo
`
      const result = schemaService.parseAndValidate(yaml)
      expect(result.valid).toBe(true)
      expect(result.schema?.groups).toHaveProperty('hero')
      expect(result.schema?.groups).toHaveProperty('about')
      expect(result.schema?.fields).toHaveProperty('hero_title')
      expect(result.schema?.collections).toHaveProperty('blog_posts')
      expect(result.schema?.collections).toHaveProperty('team')
    })
  })

  describe('generateExampleSchema', () => {
    it('should generate valid example schema YAML', () => {
      const yaml = schemaService.generateExampleSchema()

      expect(yaml).toBeTruthy()
      expect(typeof yaml).toBe('string')

      // Parse and validate the generated example
      const result = schemaService.parseAndValidate(yaml)
      expect(result.valid).toBe(true)
    })

    it('should include groups, fields, and collections', () => {
      const yaml = schemaService.generateExampleSchema()
      const result = schemaService.parseAndValidate(yaml)

      expect(result.schema?.groups).toBeDefined()
      expect(result.schema?.fields).toBeDefined()
      expect(result.schema?.collections).toBeDefined()
    })
  })
})
