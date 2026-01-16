// Types
export * from './types'

// Constants
export const API_VERSION = 'v1'
export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const JWT_ADMIN_EXPIRY = '7d'
export const JWT_CLIENT_EXPIRY = '24h'
export const RATE_LIMIT_PUBLIC = 100
export const RATE_LIMIT_CLIENT = 200
export const RATE_LIMIT_ADMIN = 500
export const WEBHOOK_RETRY_DELAYS = [60_000, 300_000, 1_800_000] // 1min, 5min, 30min
