import { api } from './api'
import type { LoginResponse, ApiResponse } from '@bifrost/shared'

interface AdminLoginInput {
  email: string
  password: string
}

interface MeResponse {
  role: 'admin' | 'client'
  id: string
  email: string
  createdAt: Date
  updatedAt: Date
  siteId?: string
  siteName?: string
}

export const authService = {
  async adminLogin(input: AdminLoginInput): Promise<LoginResponse> {
    const response = await api.post<unknown, ApiResponse<LoginResponse>>(
      '/auth/admin/login',
      input
    )
    return response.data
  },


  async getMe(): Promise<MeResponse> {
    const response = await api.get<unknown, ApiResponse<MeResponse>>('/auth/me')
    return response.data
  },
}
