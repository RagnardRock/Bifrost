import type { Request, Response, NextFunction } from 'express'
import { authService } from '../services/auth.service'
import { success } from '../utils/response'
import type { LoginInput, ClientLoginInput } from '../validators/auth.validator'

export const authController = {
  /**
   * POST /api/auth/admin/login
   * Admin login - returns JWT valid for 7 days
   */
  async adminLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body as LoginInput

      const result = await authService.adminLogin(email, password)

      res.json(success(result))
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/auth/client/login
   * Client login - returns JWT valid for 24 hours
   */
  async clientLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, siteId } = req.body as ClientLoginInput

      const result = await authService.clientLogin(email, password, siteId)

      res.json(success(result))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/auth/me
   * Get current authenticated user info
   */
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      // req.user is set by auth middleware
      const user = (req as any).user

      if (user.role === 'admin' && user.adminId) {
        const admin = await authService.getAdminById(user.adminId)
        res.json(success({ ...admin, role: 'admin' }))
      } else if (user.role === 'client' && user.userId) {
        const client = await authService.getUserById(user.userId)
        res.json(success({ ...client, role: 'client' }))
      } else {
        res.json(success({ role: user.role }))
      }
    } catch (error) {
      next(error)
    }
  },
}
