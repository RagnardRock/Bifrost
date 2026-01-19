import type { Request, Response, NextFunction } from 'express'
import { schemaService } from '../services/schema.service'
import { success } from '../utils/response'

export const schemaController = {
  /**
   * GET /api/admin/sites/:siteId/schema
   * Get site schema as YAML
   */
  async getSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = req.params.siteId!
      const yaml = await schemaService.getSiteSchemaYaml(siteId)
      res.json(success({ yaml }))
    } catch (error) {
      next(error)
    }
  },

  /**
   * PUT /api/admin/sites/:siteId/schema
   * Update site schema from YAML
   */
  async updateSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = req.params.siteId!
      const { yaml } = req.body as { yaml: string }

      if (typeof yaml !== 'string') {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Le champ yaml est requis' },
        })
        return
      }

      const result = await schemaService.updateSiteSchema(siteId, yaml)
      res.json(success(result))
    } catch (error) {
      next(error)
    }
  },

  /**
   * DELETE /api/admin/sites/:siteId/schema
   * Clear site schema
   */
  async clearSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = req.params.siteId!
      await schemaService.clearSiteSchema(siteId)
      res.json(success({ cleared: true }))
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/admin/sites/:siteId/schema/validate
   * Validate schema YAML without saving
   */
  async validateSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const { yaml } = req.body as { yaml: string }

      if (typeof yaml !== 'string') {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Le champ yaml est requis' },
        })
        return
      }

      const result = schemaService.parseAndValidate(yaml)
      res.json(success(result))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/admin/schema/example
   * Get example schema YAML
   */
  async getExample(_req: Request, res: Response, next: NextFunction) {
    try {
      const yaml = schemaService.generateExampleSchema()
      res.json(success({ yaml }))
    } catch (error) {
      next(error)
    }
  },
}
