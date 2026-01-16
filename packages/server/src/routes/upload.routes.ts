import { Router } from 'express'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware'
import { handleUpload } from '../middleware/upload.middleware'
import { uploadController } from '../controllers/upload.controller'

const router = Router()

// All upload routes require admin authentication
router.use(authMiddleware, adminMiddleware)

// GET /api/admin/upload/status - Check Cloudinary configuration
router.get('/status', uploadController.checkStatus)

// POST /api/admin/upload - Upload an image
router.post('/', handleUpload, uploadController.uploadImage)

// DELETE /api/admin/upload/:publicId - Delete an image
router.delete('/:publicId(*)', uploadController.deleteImage)

export default router
