import yaml from 'js-yaml'
import { Prisma } from '@prisma/client'
import { bifrostSchemaSchema } from '../validators/schema.validator'
import { siteRepository } from '../repositories/site.repository'
import { Errors, AppError } from '../utils/errors'
import type { BifrostSchema } from '@bifrost/shared'

export interface SchemaValidationResult {
  valid: boolean
  schema?: BifrostSchema
  errors?: string[]
}

export const schemaService = {
  /**
   * Parse YAML string to object
   */
  parseYaml(yamlString: string): unknown {
    try {
      return yaml.load(yamlString)
    } catch (error: any) {
      throw new AppError(
        'YAML_PARSE_ERROR',
        `Erreur de syntaxe YAML: ${error.message}`,
        400
      )
    }
  },

  /**
   * Validate a parsed schema object
   */
  validateSchema(schemaObj: unknown): SchemaValidationResult {
    const result = bifrostSchemaSchema.safeParse(schemaObj)

    if (!result.success) {
      const errors = result.error.errors.map((err) => {
        const path = err.path.join('.')
        return path ? `${path}: ${err.message}` : err.message
      })
      return { valid: false, errors }
    }

    return { valid: true, schema: result.data as BifrostSchema }
  },

  /**
   * Parse and validate YAML schema string
   */
  parseAndValidate(yamlString: string): SchemaValidationResult {
    // Handle empty or whitespace-only input
    if (!yamlString || !yamlString.trim()) {
      return { valid: false, errors: ['Le schéma YAML est vide'] }
    }

    // Parse YAML
    let parsed: unknown
    try {
      parsed = this.parseYaml(yamlString)
    } catch (error: any) {
      return { valid: false, errors: [error.message] }
    }

    // Validate schema structure
    return this.validateSchema(parsed)
  },

  /**
   * Update site schema from YAML
   */
  async updateSiteSchema(
    siteId: string,
    yamlString: string
  ): Promise<{ schema: BifrostSchema; yaml: string }> {
    // Check site exists
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    // Parse and validate
    const result = this.parseAndValidate(yamlString)
    if (!result.valid || !result.schema) {
      throw new AppError('SCHEMA_VALIDATION_ERROR', 'Schéma invalide', 400, {
        errors: result.errors,
      })
    }

    // Update site with new schema
    const { prisma } = await import('../config/database')
    await prisma.site.update({
      where: { id: siteId },
      data: { schema: result.schema as any },
    })

    return { schema: result.schema, yaml: yamlString }
  },

  /**
   * Get site schema as YAML
   */
  async getSiteSchemaYaml(siteId: string): Promise<string | null> {
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    if (!site.schema) {
      return null
    }

    return yaml.dump(site.schema, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    })
  },

  /**
   * Clear site schema
   */
  async clearSiteSchema(siteId: string): Promise<void> {
    const site = await siteRepository.findById(siteId)
    if (!site) {
      throw Errors.notFound('Site')
    }

    const { prisma } = await import('../config/database')
    await prisma.site.update({
      where: { id: siteId },
      data: { schema: Prisma.JsonNull },
    })
  },

  /**
   * Generate example schema YAML
   */
  generateExampleSchema(): string {
    const example: BifrostSchema = {
      groups: {
        hero: {
          label: 'Section Hero',
          fields: ['hero_title', 'hero_subtitle', 'hero_image'],
        },
        contact: {
          label: 'Contact',
          fields: ['contact_email', 'contact_phone'],
        },
      },
      fields: {
        hero_title: {
          type: 'text',
          label: 'Titre principal',
          selector: '#hero h1',
        },
        hero_subtitle: {
          type: 'richtext',
          label: 'Sous-titre',
          selector: '#hero .subtitle',
        },
        hero_image: {
          type: 'image',
          label: 'Image hero',
          selector: '#hero img',
        },
        contact_email: {
          type: 'text',
          label: 'Email de contact',
          selector: '.contact-email',
        },
        contact_phone: {
          type: 'text',
          label: 'Téléphone',
          selector: '.contact-phone',
        },
      },
      collections: {
        blog_posts: {
          label: 'Articles de blog',
          fields: {
            title: { type: 'text', label: 'Titre' },
            content: { type: 'richtext', label: 'Contenu' },
            image: { type: 'image', label: 'Image' },
            date: { type: 'date', label: 'Date de publication' },
          },
        },
        testimonials: {
          label: 'Témoignages',
          fields: {
            author: { type: 'text', label: 'Auteur' },
            quote: { type: 'richtext', label: 'Citation' },
            rating: { type: 'number', label: 'Note' },
          },
        },
      },
    }

    return yaml.dump(example, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    })
  },
}
