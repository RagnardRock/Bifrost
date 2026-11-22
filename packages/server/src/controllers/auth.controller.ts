import type { Request, Response, NextFunction } from 'express'
import { authService } from '../services/auth.service'
import { success } from '../utils/response'
import { poserSession } from '../utils/session'
import type { LoginInput, SetupInput } from '../validators/auth.validator'

export const authController = {
  /**
   * POST /api/auth/admin/login
   * Admin login - returns JWT valid for 7 days
   */
  async adminLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, code } = req.body as LoginInput

      const result = await authService.adminLogin(email, password, code)

      poserSession(res, result.token, 'admin')
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
        const client = await authService.getUserById(user.userId, user.siteId)
        res.json(success({ ...client, role: 'client' }))
      } else {
        res.json(success({ role: user.role }))
      }
    } catch (error) {
      next(error)
    }
  },

  /**
   * POST /api/auth/setup
   * Create first admin account (requires SETUP_TOKEN env var)
   */
  async setup(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, setupToken } = req.body as SetupInput

      const result = await authService.setup(email, password, setupToken)

      res.status(201).json(success(result))
    } catch (error) {
      next(error)
    }
  },
}
