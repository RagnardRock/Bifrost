import { v2 as cloudinary } from 'cloudinary'
import { config } from '../config'
import { Errors } from '../utils/errors'

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
})

export interface UploadResult {
  publicId: string
  url: string
  secureUrl: string
  width: number
  height: number
  format: string
  bytes: number
}

export const cloudinaryService = {
  /**
   * Check if Cloudinary is configured
   */
  isConfigured(): boolean {
    return !!(
      config.cloudinary.cloudName &&
      config.cloudinary.apiKey &&
      config.cloudinary.apiSecret
    )
  },

  /**
   * Upload an image buffer to Cloudinary
   */
  async uploadImage(
    buffer: Buffer,
    options: {
      folder?: string
      publicId?: string
      transformation?: object
    } = {}
  ): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw Errors.internal('Cloudinary non configure')
    }

    return new Promise((resolve, reject) => {
      const uploadOptions: any = {
        resource_type: 'image',
        folder: options.folder || 'bifrost',
        ...(options.publicId && { public_id: options.publicId }),
        ...(options.transformation && { transformation: options.transformation }),
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(Errors.internal(`Erreur upload Cloudinary: ${error.message}`))
          } else if (result) {
            resolve({
              publicId: result.public_id,
              url: result.url,
              secureUrl: result.secure_url,
              width: result.width,
              height: result.height,
              format: result.format,
              bytes: result.bytes,
            })
          } else {
            reject(Errors.internal('Reponse Cloudinary invalide'))
          }
        }
      )

      uploadStream.end(buffer)
    })
  },

  /**
   * Delete an image from Cloudinary
   */
  async deleteImage(publicId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw Errors.internal('Cloudinary non configure')
    }

    try {
      await cloudinary.uploader.destroy(publicId)
    } catch (error: any) {
      throw Errors.internal(`Erreur suppression Cloudinary: ${error.message}`)
    }
  },

  /**
   * Get optimized URL for an image
   */
  getOptimizedUrl(
    publicId: string,
    options: {
      width?: number
      height?: number
      crop?: string
      quality?: number | string
      format?: string
    } = {}
  ): string {
    return cloudinary.url(publicId, {
      secure: true,
      transformation: [
        {
          ...(options.width && { width: options.width }),
          ...(options.height && { height: options.height }),
          crop: options.crop || 'limit',
          quality: options.quality || 'auto',
          fetch_format: options.format || 'auto',
        },
      ],
    })
  },
}
