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



  // CORS - Allow any origin with '*' or list specific origins
  corsOrigins: process.env.CORS_ORIGINS === '*'
    ? true
    : process.env.CORS_ORIGINS?.split(',') ||
      (process.env.NODE_ENV !== 'production' ? true : ['http://localhost:5173']),

  // Dossier où sont rangés les sites statiques gérés par Bifrost
  sitesDir: path.resolve(process.env.SITES_DIR || path.resolve(__dirname, '../../../../donnees/sites')),

  // Adresse de l'interface Bifrost (liens d'invitation et de mot de passe oublié)
  appUrl: (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, ''),

  // E-mails : sans SMTP_URL, les liens sont affichés dans la console du serveur (et à la personne qui invite)
  smtpUrl: process.env.SMTP_URL || '',
  mailFrom: process.env.MAIL_FROM || 'Bifrost <no-reply@localhost>',

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
  const required = ['JWT_SECRET', 'DATABASE_URL']
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }
}
