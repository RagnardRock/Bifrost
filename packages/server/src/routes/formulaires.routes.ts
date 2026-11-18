/**
 * Formulaires des sites : adresse publique où les visiteurs envoient leurs messages.
 * POST /api/formulaires/<siteId>/<nom>
 *   - envoi classique (formulaire HTML) : page « Message envoyé », ou redirection vers data-bf-merci
 *   - envoi en JavaScript (Accept: application/json) : réponse JSON
 */
import { Router, type Request, type Response } from 'express'
import cors from 'cors'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { AppError } from '../utils/errors'
import { success, error } from '../utils/response'
import * as formulaires from '../services/formulaires.service'
import { nomValide } from '../services/formulaires.html'
import { siteParCle } from '../services/slug.service'
import { logger } from '../utils/logger'

const router = Router()

// Les sites sont sur d'autres domaines : tout le monde peut envoyer, sans cookie
router.use(cors({ origin: true, credentials: false, methods: ['POST'] }))

// 8 messages par quart d'heure et par adresse IP pour un même site
const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}|${req.params.siteId}`,
  handler: (req, res) => repondre(req, res, 429, 'Trop de messages envoyés d’un coup. Réessayez dans quelques minutes.'),
})

// Envoi en JavaScript avec FormData : multipart, sans fichier
const multipart = multer({ limits: { fields: 40, fieldSize: 16 * 1024, files: 0 } }).none()

const echapper = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

/** Page renvoyée au visiteur après un envoi sans JavaScript. */
function page(titre: string, texte: string, retour: string | null) {
  const lien = retour ? `<a href="${echapper(retour)}">← Revenir au site</a>` : ''
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${echapper(titre)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#f4f4f5;color:#18181b;padding:16px;box-sizing:border-box}main{max-width:420px;background:#fff;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,.08)}h1{font-size:22px;margin:0 0 8px}p{margin:0 0 16px}a{color:inherit;font-weight:600}@media(prefers-color-scheme:dark){body{background:#0b0c12;color:#e4e4e7}main{background:#16171f}}</style>
</head><body><main><h1>${echapper(titre)}</h1><p>${echapper(texte)}</p>${lien}</main></body></html>`
}

/** Page du site d'où vient l'envoi (pour le lien de retour), seulement si c'est une adresse web. */
function provenance(req: Request) {
  const r = req.get('referer')
  try { return r && /^https?:$/.test(new URL(r).protocol) ? r : null } catch { return null }
}

const veutJson = (req: Request) => req.accepts(['html', 'json']) === 'json'

function repondre(req: Request, res: Response, statut: number, message: string) {
  if (veutJson(req)) return res.status(statut).json(error(statut === 429 ? 'RATE_LIMITED' : statut === 404 ? 'NOT_FOUND' : statut >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST', message))
  res.status(statut).type('html').send(page('Message non envoyé', message, provenance(req)))
}

router.post('/:siteId/:nom', limite, (req, res, next) => multipart(req, res, (err) => (err ? repondre(req, res, 400, 'Envoi trop long ou invalide.') : next())), async (req, res) => {
  const nom = String(req.params.nom)
  try {
    const siteId = nomValide(nom) ? await siteParCle(String(req.params.siteId)) : null
    if (!siteId) return repondre(req, res, 404, 'Ce formulaire n’existe pas.')
    const r = await formulaires.recevoir(siteId, nom, (req.body ?? {}) as Record<string, unknown>)
    if (veutJson(req)) return res.json(success({ envoye: true }))
    const retour = provenance(req)
    if (r.merci && retour) {
      try { return res.redirect(303, new URL(r.merci, retour).toString()) } catch { /* adresse invalide : page par défaut */ }
    }
    res.type('html').send(page('Message envoyé', 'Merci, votre message est bien arrivé. Nous vous répondrons dès que possible.', retour))
  } catch (e) {
    if (e instanceof AppError) return repondre(req, res, e.statusCode, e.statusCode === 404 ? 'Ce formulaire n’existe pas.' : e.message)
    logger.error({ err: e }, 'formulaire : envoi impossible')
    repondre(req, res, 500, 'Le message n’a pas pu être envoyé. Réessayez un peu plus tard.')
  }
})

export default router
