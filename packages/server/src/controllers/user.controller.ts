import type { Request, Response, NextFunction } from 'express'
import { userService } from '../services/user.service'
import { success } from '../utils/response'
import type { CreateUserDto, UpdateUserDto } from '../validators/user.validator'

export const userController = {
  /**
   * GET /api/admin/sites/:siteId/users
   * List all users for a site
   */
  async listBySite(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = req.params.siteId!
      const users = await userService.listBySite(siteId)
      res.json(success(users))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/admin/sites/:siteId/users/:id
   * Get a single user
   */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id!
      const user = await userService.getById(id)
      res.json(success(user))
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/admin/sites/:siteId/users
   * Create a new user for a site
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const siteId = req.params.siteId!
      const data = req.body as CreateUserDto

      const user = await userService.create({
        email: data.email,
        password: data.password,
        siteId,
      })

      res.status(201).json(success(user))
    } catch (error) {
      next(error)
    }
  },

  /**
   * PUT /api/admin/sites/:siteId/users/:id
   * Update a user
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id!
      const data = req.body as UpdateUserDto

      const user = await userService.update(id, {
        email: data.email,
        password: data.password,
      })

      res.json(success(user))
    } catch (error) {
      next(error)
    }
  },

  /**
   * DELETE /api/admin/sites/:siteId/users/:id
   * Delete a user
   */
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id!
      await userService.delete(id)
      res.json(success({ deleted: true }))
    } catch (error) {
      next(error)
    }
  },
}
