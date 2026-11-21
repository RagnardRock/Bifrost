import { api } from './api'
import type { LoginResponse, ApiResponse } from '@bifrost/shared'
import type { ApiDoubleAuth, EtatDoubleAuth } from './comptes.service'

interface AdminLoginInput {
  email: string
  password: string
  /** Code de double authentification, si elle est active */
  code?: string
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

/** Double authentification du compte dev. */
export const doubleAuthDev = {
  etat: () => api.get('/auth/double-auth').then((r: any) => r.data as EtatDoubleAuth),
  preparer: () => api.post('/auth/double-auth/preparer').then((r: any) => r.data as { secret: string; adresse: string }),
  activer: (code: string) => api.post('/auth/double-auth/activer', { code }).then((r: any) => r.data as { codes: string[] }),
  desactiver: (motDePasse: string, code: string) => api.post('/auth/double-auth/desactiver', { motDePasse, code }),
  codes: (code: string) => api.post('/auth/double-auth/codes', { code }).then((r: any) => r.data as { codes: string[] }),
} satisfies ApiDoubleAuth
