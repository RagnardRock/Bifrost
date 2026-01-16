import type { ApiResponse, ApiErrorResponse } from '@bifrost/shared'

export function success<T>(data: T): ApiResponse<T> {
  return { success: true, data }
}

export function error(code: string, message: string, details?: Record<string, unknown>): ApiErrorResponse {
  return {
    success: false,
    error: { code, message, details },
  }
}
