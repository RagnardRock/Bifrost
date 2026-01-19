import type { Request, Response, NextFunction } from 'express'
import { siteService } from '../services/site.service'
import { success } from '../utils/response'
import type { CreateSiteDto, UpdateSiteDto } from '../validators/site.validator'

export const siteController = {
  /**
   * GET /api/admin/sites
   * List all sites
   */
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const sites = await siteService.list()
      res.json(success(sites))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/admin/sites/:id
   * Get a single site by ID
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id!
      const site = await siteService.getById(id)
      res.json(success(site))
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/admin/sites
   * Create a new site
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body as CreateSiteDto

      const site = await siteService.create({
        name: data.name,
        url: data.url,
        webhookUrl: data.webhookUrl || undefined,
      })

      res.status(201).json(success(site))
    } catch (error) {
      next(error)
    }
  },

  /**
   * PUT /api/admin/sites/:id
   * Update a site
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id!
      const data = req.body as UpdateSiteDto

      const site = await siteService.update(id, {
        name: data.name,
        url: data.url,
        webhookUrl: data.webhookUrl ?? undefined,
      })

      res.json(success(site))
    } catch (error) {
      next(error)
    }
  },

  /**
   * DELETE /api/admin/sites/:id
   * Delete a site
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id!
      await siteService.delete(id)
      res.json(success({ deleted: true }))
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/admin/sites/:id/regenerate-key
   * Regenerate API key for a site
   */
  async regenerateApiKey(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id!
      const site = await siteService.regenerateApiKey(id)
      res.json(success(site))
    } catch (error) {
      next(error)
    }
  },
}
