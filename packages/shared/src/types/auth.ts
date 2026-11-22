import type { Admin } from './admin'
import type { UserWithSite } from './user'

/**
 * JWT Token payload
 */
export interface TokenPayload {
  userId?: string
  adminId?: string
  siteId?: string
  role: 'admin' | 'client'
  /** Session limitée : le compte dev doit d'abord activer sa double authentification */
  portee?: 'double-auth'
  iat?: number
  exp?: number
}

/**
 * Login response
 */
export interface LoginResponse {
  token: string
  expiresAt: Date
  /** Compte dev sans double authentification : la session ne sert qu'à l'activer */
  doubleAuthAActiver?: boolean
  user: Admin | UserWithSite
}

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: true
  data: T
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ApiErrorResponse {
  success: false
  error: ApiError
}
