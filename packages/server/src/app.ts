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
import { apercuRouter, parDomaine } from './routes/apercu.routes'
import { autoriser } from './services/domaines.service'
import formulairesRouter from './routes/formulaires.routes'
import devRouter from './routes/dev.routes'

export const app = express()

// En ligne, Bifrost est derrière le serveur web (Caddy) : l'adresse du visiteur vient de X-Forwarded-For (limites de débit)
if (!config.isDev) app.set('trust proxy', 1)

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // l'aperçu sert les pages des sites clients telles quelles
}))
// Caddy, avant de créer le certificat HTTPS d'un domaine inconnu : « est-il à toi ? » (200 oui, 404 non)
app.get('/api/caddy/autoriser', (req, res, next) => {
  autoriser(String(req.query.domain || '')).then((ok) => res.status(ok ? 200 : 404).end()).catch(next)
})

// Domaine propre d'un client : on sert son site, avant tout le reste
app.use(parDomaine)

// Formulaires des sites clients : ouverts à tous les domaines (avant la règle CORS de l'interface)
app.use('/api/formulaires', express.urlencoded({ extended: true, limit: '64kb' }), express.json({ limit: '64kb' }), formulairesRouter)

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

// Outils du dev (Rune) : un envoi contient tout le site, d'où la limite plus haute
app.use('/api/dev', express.json({ limit: '300mb' }), devRouter)

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

// En production, le serveur sert aussi l'interface (application Vue) : toute adresse
// qui n'est ni l'API, ni un aperçu, ni un site renvoie index.html et Vue affiche la bonne page.
if (config.nodeEnv === 'production') {
  app.use(express.static(config.clientDir, {
    index: false,
    // Appli installable : le service worker et le manifeste sont toujours relus (mise à jour de l'appli)
    setHeaders: (res, fichier) => {
      if (/[\\/](sw\.js|manifest\.webmanifest)$/.test(fichier)) res.setHeader('Cache-Control', 'no-cache')
      if (fichier.endsWith('.webmanifest')) res.setHeader('Content-Type', 'application/manifest+json')
    },
  }))
  app.get(/^\/(?!api\/|apercu\/|sites\/|editeur\/|health$).*/, (_req, res) => {
    res.sendFile(path.join(config.clientDir, 'index.html'))
  })
}

// 404 handler for API routes
app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route non trouvée' } })
})

// Error handler (must be last)
app.use(errorMiddleware)
