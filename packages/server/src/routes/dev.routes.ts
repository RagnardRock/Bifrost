/**
 * API des outils du dev (Rune) : /api/dev
 *
 * Connexion : POST /connexion { email, motDePasse, appareil } → un jeton « bfd_… » long et révocable,
 * à envoyer ensuite en « Authorization: Bearer ». Un jeton admin de l'interface marche aussi.
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import { success } from '../utils/response'
import { comparePassword } from '../utils/hash'
import { verifyToken } from '../utils/jwt'
import * as dev from '../services/dev.service'
import * as suivi from '../services/suivi.service'
import * as fichiers from '../services/site-fichiers.service'
import { siteParCle } from '../services/slug.service'
import { verifierConnexion } from '../services/double-auth.service'

const router = Router()

const action = (fn: (req: Request) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req).then((d) => res.json(success(d))).catch(next)

const limiteConnexion = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Trop d’essais de connexion, réessayez dans un quart d’heure' } },
})

router.post('/connexion', limiteConnexion, action(async (req) => {
  const b = z.object({ email: z.string().trim().toLowerCase().email(), motDePasse: z.string().min(1).max(200), appareil: z.string().trim().max(80).default('Rune'), code: z.string().trim().max(20).optional() }).parse(req.body)
  const admin = await prisma.admin.findUnique({ where: { email: b.email } })
  if (!admin || !(await comparePassword(b.motDePasse, admin.passwordHash))) throw Errors.unauthorized('E-mail ou mot de passe incorrect')
  // Double authentification du compte dev : CODE_REQUIS si le code manque (Rune redemande avec le code)
  await verifierConnexion('admin', admin, b.code)
  const { jeton, id } = await dev.creerJeton(admin.id, b.appareil)
  return { jeton, id, email: admin.email }
}))

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { jetonDevId?: string } }
}

/** Jeton d'un outil (bfd_…) ou jeton admin de l'interface. */
function devAuth(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) return next(Errors.unauthorized('Connexion à Bifrost nécessaire'))
  const jeton = h.slice(7)
  if (jeton.startsWith(dev.PREFIXE_JETON)) {
    dev.verifierJeton(jeton).then((j) => {
      if (!j) return next(Errors.unauthorized('Connexion expirée ou retirée : reconnectez-vous'))
      req.user = { adminId: j.adminId, role: 'admin' } as never
      req.jetonDevId = j.id
      next()
    }).catch(next)
    return
  }
  try {
    const p = verifyToken(jeton)
    if (p.role !== 'admin') return next(Errors.forbidden('Réservé au compte dev'))
    req.user = p
    next()
  } catch {
    next(Errors.unauthorized('Connexion expirée : reconnectez-vous'))
  }
}
router.use(devAuth)

const adminId = (req: Request) => String(req.user?.adminId)

router.get('/moi', action(async (req) => {
  const a = await prisma.admin.findUnique({ where: { id: adminId(req) }, select: { email: true } })
  if (!a) throw Errors.unauthorized('Compte dev introuvable')
  return { email: a.email }
}))

// Se déconnecter : retire le jeton utilisé
router.delete('/connexion', action(async (req) => {
  if (req.jetonDevId) await prisma.jetonDev.delete({ where: { id: req.jetonDevId } }).catch(() => {})
  return { ok: true }
}))

// Appareils connectés (jetons) du compte dev
router.get('/jetons', action(async (req) =>
  (await prisma.jetonDev.findMany({ where: { adminId: adminId(req) }, orderBy: { createdAt: 'desc' }, select: { id: true, appareil: true, createdAt: true, dernierUsage: true } }))
    .map((j) => ({ ...j, actuel: j.id === req.jetonDevId }))))
router.delete('/jetons/:id', action(async (req) => {
  await prisma.jetonDev.deleteMany({ where: { id: String((req.params as Record<string, string>).id), adminId: adminId(req) } })
  return { ok: true }
}))

router.get('/sites', action(async () => suivi.sites()))

// ---------- un site (par son nom court ou son identifiant) ----------

const site = Router({ mergeParams: true })
router.use('/sites/:cle', (req, _res, next) => {
  siteParCle(String((req.params as Record<string, string>).cle)).then((id) => {
    if (!id) return next(Errors.notFound('Site'))
    ;(req as Request & { siteId?: string }).siteId = id
    next()
  }).catch(next)
}, site)
const sid = (req: Request) => String((req as Request & { siteId?: string }).siteId)
const version = (req: Request): dev.Version => (req.query.version === 'brouillon' ? 'brouillon' : 'publie')

// Fiche : modifications non publiées de l'équipe du client, publications (historique)
site.get('/', action(async (req) => {
  const f = await suivi.site(sid(req))
  if (!f) throw Errors.notFound('Site')
  const enAttente = await fichiers.changements(sid(req)).catch(() => [])
  return { ...f, enAttente }
}))

site.get('/manifeste', action(async (req) => dev.manifeste(sid(req), version(req))))

site.get('/fichier', (req, res, next) => {
  const chemin = String(req.query.chemin || '')
  dev.lireFichier(sid(req), version(req), chemin)
    .then((b) => res.type('application/octet-stream').send(b))
    .catch(next)
})

// Une publication : les fichiers remplacés sont dans l'historique, les nouveaux dans la version en ligne
const corpsEnvoi = z.object({
  manifeste: z.record(z.string()),
  fichiers: z.record(z.string()).default({}),
  supprimer: z.boolean().default(false),
  ecraserBrouillon: z.boolean().default(false),
  depuis: z.coerce.date().optional(),
})

site.post('/envoi/essai', action(async (req) => {
  const b = corpsEnvoi.parse(req.body)
  return dev.essaiEnvoi(sid(req), b, b.depuis)
}))

site.post('/envoi', action(async (req) => {
  const b = corpsEnvoi.parse(req.body)
  const r = await dev.envoyer(sid(req), adminId(req), b)
  if (r.publication) suivi.journaliser(sid(req), adminId(req), 'publication', `envoyé depuis Rune : ${(r.publication.changements as unknown[]).length} modification(s)`)
  return r
}))

export default router
