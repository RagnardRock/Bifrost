import { api } from './api'
import type { ApiResponse } from '@bifrost/shared'

export interface UploadResult {
  publicId: string
  url: string
  width: number
  height: number
  format: string
  size: number
}

export const uploadService = {
  /**
   * Upload an image (admin endpoint)
   */
  async uploadImageAdmin(file: File, folder?: string): Promise<UploadResult> {
    const formData = new FormData()
    formData.append('image', file)
    if (folder) {
      formData.append('folder', folder)
    }

    const response = await api.post<unknown, ApiResponse<UploadResult>>(
      '/admin/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  /**
   * Upload an image (client endpoint)
   */
  async uploadImageClient(file: File): Promise<UploadResult> {
    const formData = new FormData()
    formData.append('image', file)

    const response = await api.post<unknown, ApiResponse<UploadResult>>(
      '/client/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  /**
   * Delete an image (admin only)
   */
  async deleteImage(publicId: string): Promise<void> {
    await api.delete(`/admin/upload/${encodeURIComponent(publicId)}`)
  },

  /**
   * Check if Cloudinary is configured
   */
  async checkStatus(): Promise<{ configured: boolean; message: string }> {
    const response = await api.get<unknown, ApiResponse<{ configured: boolean; message: string }>>(
      '/admin/upload/status'
    )
    return response.data
  },
}
