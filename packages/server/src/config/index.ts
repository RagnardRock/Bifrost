import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') })

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtAdminExpiry: '7d',
  jwtClientExpiry: '24h',

  // Webhook
  webhookSecret: process.env.WEBHOOK_SECRET || 'webhook-secret-change-in-production',

  // Cloudinary
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },

  // CORS - Allow any origin in development for easier testing
  corsOrigins: process.env.CORS_ORIGINS?.split(',') ||
    (process.env.NODE_ENV !== 'production' ? true : ['http://localhost:5173']),

  // Rate limiting
  rateLimit: {
    public: 100,
    client: 200,
    admin: 500,
    auth: 10,
    upload: 10,
  },
} as const

// Validate required config in production
if (!config.isDev) {
  const required = ['JWT_SECRET', 'DATABASE_URL', 'WEBHOOK_SECRET']
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }
}
