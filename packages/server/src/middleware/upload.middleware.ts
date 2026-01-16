import multer from 'multer'
import { MAX_FILE_SIZE, SUPPORTED_IMAGE_TYPES } from '@bifrost/shared'
import { Errors } from '../utils/errors'

/**
 * Multer configuration for image uploads
 * Uses memory storage for Cloudinary uploads
 */
const storage = multer.memoryStorage()

/**
 * File filter to only accept supported image types
 */
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (SUPPORTED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`Type de fichier non supporte. Types acceptes: ${SUPPORTED_IMAGE_TYPES.join(', ')}`))
  }
}

/**
 * Multer upload middleware configured for images
 */
export const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE, // 5MB from shared constants
    files: 1,
  },
}).single('image')

/**
 * Wrapper middleware to handle multer errors properly
 */
export function handleUpload(req: any, res: any, next: any) {
  uploadImage(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(Errors.badRequest(`Fichier trop volumineux. Taille max: ${MAX_FILE_SIZE / 1024 / 1024}MB`))
      }
      return next(Errors.badRequest(err.message))
    } else if (err) {
      return next(Errors.badRequest(err.message))
    }
    next()
  })
}
