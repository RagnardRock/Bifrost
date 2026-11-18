/**
 * Éditeur sur place (v2) : le client modifie son vrai site statique, puis publie.
 * Accessible au dev (admin, tous les sites) et au client (son site uniquement).
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../config/database'
import { config } from '../config'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware'
import { Errors } from '../utils/errors'
import { success } from '../utils/response'
import * as fichiers from '../services/site-fichiers.service'
import * as comptes from '../services/comptes.service'
import { journaliser } from '../services/suivi.service'

const router = Router({ mergeParams: true })

const envoi = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, f, cb) => cb(null, /^image\/(jpeg|png|webp|gif|heic|heif|avif)$/.test(f.mimetype)),
}).single('image')

/** Admin (dev) : tous les sites. Client : seulement un membre de l'équipe du site, rôle relu en base à chaque requête. */
function peutEditer(req: Request, _res: Response, next: NextFunction) {
  const u = req.user
  if (u?.role === 'admin') { req.roleSite = 'responsable'; return next() }
  if (u?.role !== 'client' || !u.userId || u.siteId !== sid(req)) return next(Errors.forbidden('Vous ne pouvez pas modifier ce site'))
  prisma.user.findFirst({ where: { id: u.userId, siteId: sid(req) }, select: { role: true } })
    .then((m) => {
      if (!m) return next(Errors.forbidden('Vous ne faites plus partie de l’équipe de ce site'))
      req.roleSite = m.role as comptes.Role
      next()
    })
    .catch(next)
}

/** Publier, revenir en arrière, gérer l'équipe : responsables et dev seulement. */
function responsable(req: Request, _res: Response, next: NextFunction) {
  if (req.roleSite === 'responsable') return next()
  next(Errors.forbidden('Seul un responsable du site peut faire cela'))
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { roleSite?: comptes.Role } }
}

const sid = (req: Request) => String((req.params as Record<string, string>).siteId)
const auteur = (req: Request) => req.user?.userId || req.user?.adminId || null
const action = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).then((d) => res.json(success(d))).catch(next)

router.use(authMiddleware, peutEditer)

// État général : pages et modifications non publiées
router.get('/', action(async (req) => {
  const site = await prisma.site.findUnique({ where: { id: sid(req) }, select: { id: true, name: true, url: true, slug: true } })
  if (!site) throw Errors.notFound('Site')
  return {
    site,
    pages: await fichiers.listerPages(site.id),
    differences: await fichiers.differences(site.id),
    moi: { role: req.roleSite, dev: req.user?.role === 'admin', id: req.user?.userId || null },
  }
}))

// Jeton d'aperçu : cookie lu par /apercu/<siteId>/… (l'iframe ne peut pas envoyer d'en-tête)
router.post('/session', action(async (req, res) => {
  const jeton = jwt.sign({ siteId: sid(req) }, config.jwtSecret, { expiresIn: '12h' })
  res.cookie('bf_apercu', jeton, { httpOnly: true, sameSite: 'lax', secure: !config.isDev, path: `/apercu/${sid(req)}`, maxAge: 12 * 3600 * 1000 })
  return { ok: true }
}))

router.get('/page', action(async (req) => fichiers.analyserPage(sid(req), String(req.query.chemin || 'index.html'))))

const schemaChamp = z.object({ cle: z.string().min(1).max(200), valeur: z.string().max(100_000) })
router.put('/champ', action(async (req) => {
  const { cle, valeur } = schemaChamp.parse(req.body)
  const r = await fichiers.modifierChamp(sid(req), cle, valeur)
  journaliser(sid(req), auteur(req), /^medias\//.test(valeur) ? 'image' : 'modification', cle)
  return r
}))

const schemaListe = z.object({
  page: z.string().min(1),
  nom: z.string().min(1).max(200),
  op: z.enum(['modifier', 'supprimer', 'deplacer', 'dupliquer']),
  index: z.number().int().min(0),
  vers: z.number().int().min(0).optional(),
  cle: z.string().max(200).optional(),
  valeur: z.string().max(100_000).optional(),
})
router.post('/liste', action(async (req) => {
  const b = schemaListe.parse(req.body)
  const o = b.op === 'modifier' ? { op: b.op, index: b.index, cle: b.cle || '', valeur: b.valeur ?? '' }
    : b.op === 'deplacer' ? { op: b.op, index: b.index, vers: b.vers ?? b.index }
    : { op: b.op, index: b.index }
  const r = await fichiers.operationListe(sid(req), b.page, b.nom, o as never)
  journaliser(sid(req), auteur(req), b.op === 'modifier' && /^medias\//.test(b.valeur || '') ? 'image' : b.op === 'modifier' ? 'modification' : 'liste',
    b.op === 'modifier' ? `${b.nom} n°${b.index + 1} · ${b.cle}` : `${b.nom} n°${b.index + 1} · ${({ supprimer: 'supprimé', deplacer: 'déplacé', dupliquer: 'dupliqué' } as Record<string, string>)[b.op]}`)
  return r
}))

router.post('/image', (req, res, next) => envoi(req, res, (err) => {
  if (err) return next(Errors.badRequest('Image trop lourde (20 Mo maximum)'))
  if (!req.file) return next(Errors.badRequest('Format d’image non pris en charge'))
  fichiers.enregistrerImage(sid(req), req.file.buffer)
    .then((chemin) => res.json(success({ chemin })))
    .catch(() => next(Errors.badRequest('Image illisible')))
}))

const schemaElement = z.object({
  titre: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  texte: z.string().max(100_000).optional(),
  photos: z.array(z.string().regex(/^medias\/[\w.-]+$/)).max(50).default([]),
})
router.post('/collection/:nom', action(async (req) => {
  const d = schemaElement.parse(req.body)
  const r = await fichiers.nouvelElement(sid(req), String((req.params as Record<string, string>).nom), d)
  journaliser(sid(req), auteur(req), 'actualite', d.titre)
  return r
}))

router.post('/publier', responsable, action(async (req) => {
  const siteId = sid(req)
  const pub = await prisma.publication.create({ data: { siteId, auteur: auteur(req), ajoutes: [], modifies: [], supprimes: [] } })
  const diff = await fichiers.publier(siteId, pub.id)
  if (!diff.ajoutes.length && !diff.modifies.length && !diff.supprimes.length) {
    await prisma.publication.delete({ where: { id: pub.id } })
    return { publication: null }
  }
  journaliser(siteId, auteur(req), 'publication', `${diff.ajoutes.length + diff.modifies.length + diff.supprimes.length} fichier(s)`)
  return { publication: await prisma.publication.update({ where: { id: pub.id }, data: diff }) }
}))

router.post('/abandonner', responsable, action(async (req) => {
  await fichiers.abandonnerBrouillon(sid(req))
  journaliser(sid(req), auteur(req), 'abandon')
  return { ok: true }
}))

router.get('/publications', action(async (req) =>
  prisma.publication.findMany({ where: { siteId: sid(req) }, orderBy: { createdAt: 'desc' }, take: 30 })))

// Revenir en arrière : seule la dernière publication encore active peut être annulée (sinon les fichiers se mélangent)
router.post('/publications/:id/annuler', responsable, action(async (req) => {
  const siteId = sid(req)
  const derniere = await prisma.publication.findFirst({ where: { siteId, annulee: false }, orderBy: { createdAt: 'desc' } })
  if (!derniere || derniere.id !== String((req.params as Record<string, string>).id)) throw Errors.badRequest('Seule la dernière publication peut être annulée')
  await fichiers.annulerPublication(siteId, derniere.id, derniere as never)
  journaliser(siteId, auteur(req), 'annulation', `publication du ${derniere.createdAt.toLocaleString('fr-FR')}`)
  return prisma.publication.update({ where: { id: derniere.id }, data: { annulee: true } })
}))

// Équipe du site : membres, rôles, invitations
const param = (req: Request, nom: string) => String((req.params as Record<string, string>)[nom])
const schemaRole = z.enum(['responsable', 'redacteur'])
router.get('/equipe', responsable, action(async (req) => comptes.equipe(sid(req))))
router.post('/equipe/invitations', responsable, action(async (req) => {
  const b = z.object({ email: z.string().email(), role: schemaRole }).parse(req.body)
  const qui = req.user?.role === 'admin' ? 'Votre développeur' : 'Un membre de votre équipe'
  const r = await comptes.inviter(sid(req), b.email, b.role, qui)
  journaliser(sid(req), auteur(req), 'invitation', `${b.email} (${b.role})`)
  return r
}))
router.delete('/equipe/invitations/:id', responsable, action(async (req) => comptes.annulerInvitation(sid(req), param(req, 'id'))))
router.put('/equipe/membres/:id', responsable, action(async (req) => {
  const m = await comptes.changerRole(sid(req), param(req, 'id'), z.object({ role: schemaRole }).parse(req.body).role)
  journaliser(sid(req), auteur(req), 'role', `${m.email} → ${m.role}`)
  return m
}))
router.delete('/equipe/membres/:id', responsable, action(async (req) => {
  const email = (await prisma.user.findFirst({ where: { id: param(req, 'id'), siteId: sid(req) }, select: { email: true } }))?.email
  const r = await comptes.retirer(sid(req), param(req, 'id'), req.user?.userId || null)
  journaliser(sid(req), auteur(req), 'retrait', email || '')
  return r
}))

// Dev uniquement : importer un dossier de site présent sur le serveur
router.post('/importer', adminMiddleware, action(async (req) => {
  const { dossier } = z.object({ dossier: z.string().min(1) }).parse(req.body)
  return fichiers.importer(sid(req), dossier)
}))

export default router
