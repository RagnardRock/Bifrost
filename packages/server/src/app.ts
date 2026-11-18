import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from './config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import { errorMiddleware } from './middleware/error.middleware'
import { logger } from './utils/logger'
import { success } from './utils/response'
import routes from './routes'
import cookieParser from 'cookie-parser'
import { apercuRouter } from './routes/apercu.routes'

export const app = express()

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // l'aperçu sert les pages des sites clients telles quelles
}))
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
)

// Fichiers de Bifrost servis tels quels (script de l'éditeur sur place)
app.use(express.static(path.join(__dirname, '../public')))

// Aperçu du brouillon (dans l'éditeur) et site publié (essais en local)
app.use(cookieParser())
app.use(apercuRouter)

// Body parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Request logging
app.use((req, _res, next) => {
  logger.info({ method: req.method, path: req.path }, 'Incoming request')
  next()
})

// Health check
app.get('/health', (_req, res) => {
  res.json(success({ status: 'healthy', timestamp: new Date().toISOString() }))
})

// API info
app.get('/api', (_req, res) => {
  res.json(success({ message: 'Bifrost API', version: '0.2.0' }))
})

// API routes
app.use('/api', routes)

// Serve admin client in production
if (config.nodeEnv === 'production') {
  const clientPath = path.join(__dirname, '../../../client/dist')

  // Serve static assets
  app.use('/admin', express.static(clientPath))

  // SPA fallback - serve index.html for any admin route
  app.get('/admin/*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'))
  })

  // Redirect root to admin
  app.get('/', (_req, res) => {
    res.redirect('/admin')
  })
}

// 404 handler for API routes
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route non trouvée' } })
})

// Error handler (must be last)
app.use(errorMiddleware)
