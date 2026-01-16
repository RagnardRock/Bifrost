import type { Request, Response, NextFunction } from 'express'
import { cloudinaryService } from '../services/cloudinary.service'
import { success } from '../utils/response'
import { Errors } from '../utils/errors'

export const uploadController = {
  /**
   * POST /api/admin/upload
   * Upload an image to Cloudinary
   */
  async uploadImage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw Errors.badRequest('Aucun fichier fourni')
      }

      // Get optional folder from query or body
      const folder = (req.query.folder as string) || (req.body.folder as string) || 'bifrost'

      const result = await cloudinaryService.uploadImage(req.file.buffer, {
        folder,
      })

      res.json(success({
        publicId: result.publicId,
        url: result.secureUrl,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
      }))
    } catch (error) {
      next(error)
    }
  },

  /**
   * DELETE /api/admin/upload/:publicId
   * Delete an image from Cloudinary
   */
  async deleteImage(req: Request, res: Response, next: NextFunction) {
    try {
      const { publicId } = req.params

      if (!publicId) {
        throw Errors.badRequest('Public ID requis')
      }

      // Decode the publicId (it may contain slashes encoded as %2F)
      const decodedPublicId = decodeURIComponent(publicId)

      await cloudinaryService.deleteImage(decodedPublicId)

      res.json(success({ deleted: true }))
    } catch (error) {
      next(error)
    }
  },

  /**
   * GET /api/admin/upload/status
   * Check if Cloudinary is configured
   */
  async checkStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const configured = cloudinaryService.isConfigured()

      res.json(success({
        configured,
        message: configured
          ? 'Cloudinary configure'
          : 'Cloudinary non configure. Verifiez les variables CLOUDINARY_*',
      }))
    } catch (error) {
      next(error)
    }
  },
}
