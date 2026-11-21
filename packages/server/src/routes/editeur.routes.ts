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
import { siteParCle } from '../services/slug.service'
import * as formulaires from '../services/formulaires.service'
import * as blocs from '../services/blocs.service'
import { modificationsAPublier } from '../services/notifications.service'

const router = Router({ mergeParams: true })

const envoi = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, f, cb) => cb(null, /^image\/(jpeg|png|webp|gif|heic|heif|avif)$/.test(f.mimetype)),
}).single('image')

/** Admin (dev) : tous les sites. Client : les sites dont il fait partie de l'équipe, rôle relu en base à chaque requête. */
function peutEditer(req: Request, _res: Response, next: NextFunction) {
  const u = req.user
  if (u?.role === 'admin') { req.roleSite = 'responsable'; return next() }
  if (u?.role !== 'client' || !u.userId) return next(Errors.forbidden('Vous ne pouvez pas modifier ce site'))
  prisma.membre.findUnique({ where: { userId_siteId: { userId: u.userId, siteId: sid(req) } }, select: { role: true } })
    .then((m) => {
      if (!m) return next(Errors.forbidden('Vous ne faites pas partie de l’équipe de ce site'))
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

/** Identifiant du site : l'adresse peut donner le nom court ou l'uuid, résolu une fois par requête. */
const sid = (req: Request) => (req as Request & { siteResolu?: string }).siteResolu ?? String((req.params as Record<string, string>).siteId)
const auteur = (req: Request) => req.user?.userId || req.user?.adminId || null
/** Un rédacteur vient de modifier le brouillon : les responsables sont prévenus sur leur téléphone. */
const signaler = (req: Request) => { if (req.roleSite === 'redacteur') void modificationsAPublier(sid(req), req.user?.userId || null) }
const action = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res).then((d) => res.json(success(d))).catch(next)

router.use((req, _res, next) => {
  siteParCle(String((req.params as Record<string, string>).siteId))
    .then((id) => {
      if (!id) return next(Errors.notFound('Site'))
      ;(req as Request & { siteResolu?: string }).siteResolu = id
      next()
    })
    .catch(next)
})
router.use(authMiddleware, peutEditer)

// État général : pages et modifications non publiées
router.get('/', action(async (req) => {
  const site = await prisma.site.findUnique({ where: { id: sid(req) }, select: { id: true, name: true, url: true, slug: true } })
  if (!site) throw Errors.notFound('Site')
  return {
    site,
    pages: await fichiers.listerPages(site.id),
    ...await (async () => { const differences = await fichiers.differences(site.id); return { differences, changements: await fichiers.changements(site.id, differences) } })(),
    moi: { role: req.roleSite, dev: req.user?.role === 'admin', id: req.user?.userId || null },
    messagesNonLus: req.roleSite === 'responsable' ? await formulaires.nonLus(site.id) : 0,
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
  signaler(req)
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
  signaler(req)
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
  signaler(req)
  return r
}))

router.post('/publier', responsable, action(async (req) => {
  const siteId = sid(req)
  const pub = await prisma.publication.create({ data: { siteId, auteur: auteur(req), ajoutes: [], modifies: [], supprimes: [] } })
  const avant = await fichiers.differences(siteId)
  const changements = await fichiers.changements(siteId, avant)
  const diff = await fichiers.publier(siteId, pub.id)
  if (!diff.ajoutes.length && !diff.modifies.length && !diff.supprimes.length) {
    await prisma.publication.delete({ where: { id: pub.id } })
    return { publication: null }
  }
  journaliser(siteId, auteur(req), 'publication', `${changements.length} modification(s)`)
  return { publication: await prisma.publication.update({ where: { id: pub.id }, data: { ...diff, changements: changements as never } }) }
}))

router.post('/abandonner', responsable, action(async (req) => {
  await fichiers.abandonnerBrouillon(sid(req))
  journaliser(sid(req), auteur(req), 'abandon')
  return { ok: true }
}))

router.get('/publications', action(async (req) =>
  prisma.publication.findMany({ where: { siteId: sid(req) }, orderBy: { createdAt: 'desc' }, take: 30 })))

// Revenir en arrière : remet le site tel qu'il était avant cette publication,
// en annulant aussi toutes les publications qui ont suivi (de la plus récente à la plus ancienne)
router.post('/publications/:id/annuler', responsable, action(async (req) => {
  const siteId = sid(req)
  const cible = await prisma.publication.findFirst({ where: { id: String((req.params as Record<string, string>).id), siteId, annulee: false } })
  if (!cible) throw Errors.badRequest('Cette publication est déjà annulée')
  const aAnnuler = await prisma.publication.findMany({
    where: { siteId, annulee: false, createdAt: { gte: cible.createdAt } },
    orderBy: { createdAt: 'desc' },
  })
  for (const p of aAnnuler) {
    await fichiers.annulerPublication(siteId, p.id, p as never)
    await prisma.publication.update({ where: { id: p.id }, data: { annulee: true } })
  }
  const n = aAnnuler.length
  journaliser(siteId, auteur(req), 'annulation', `publication du ${cible.createdAt.toLocaleString('fr-FR')}${n > 1 ? ` (et les ${n - 1} suivantes)` : ''}`)
  return { annulees: n }
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
  const email = (await prisma.user.findUnique({ where: { id: param(req, 'id') }, select: { email: true } }))?.email
  const r = await comptes.retirer(sid(req), param(req, 'id'), req.user?.userId || null)
  journaliser(sid(req), auteur(req), 'retrait', email || '')
  return r
}))

// Réglages du site modifiables par ses responsables (espace « Mon site »)
const selectReglages = { id: true, name: true, url: true, slug: true, emailMessages: true } as const
router.get('/reglages', responsable, action(async (req) => prisma.site.findUnique({ where: { id: sid(req) }, select: selectReglages })))
router.put('/reglages', responsable, action(async (req) => {
  const b = z.object({ nom: z.string().trim().min(1).max(120).optional(), emailMessages: z.string().trim().max(500).optional() }).parse(req.body)
  const adresses = b.emailMessages?.split(/[,;\s]+/).map((a) => a.trim()).filter(Boolean)
  if (adresses?.some((a) => !z.string().email().safeParse(a).success)) throw Errors.badRequest('Adresse de réception des messages invalide')
  if (adresses && adresses.length > 5) throw Errors.badRequest('5 adresses de réception au maximum')
  return prisma.site.update({
    where: { id: sid(req) },
    data: { ...(b.nom ? { name: b.nom } : {}), ...(adresses ? { emailMessages: adresses.join(', ') || null } : {}) },
    select: selectReglages,
  })
}))

// Messages reçus par les formulaires du site : responsables et dev
router.get('/messages', responsable, action(async (req) => formulaires.lister(sid(req))))
router.put('/messages/:id', responsable, action(async (req) => {
  const { lu } = z.object({ lu: z.boolean() }).parse(req.body)
  await formulaires.marquerLu(sid(req), param(req, 'id'), lu)
  return { lu }
}))
router.delete('/messages/:id', responsable, action(async (req) => formulaires.supprimer(sid(req), param(req, 'id'))))

// Mode dev : poser des flags, modifier, dupliquer, déplacer ou supprimer n'importe quel élément (dev uniquement)
const nomFlag = z.string().max(100).nullable().optional()
const schemaChemin = z.array(z.number().int().min(0).max(10_000)).min(1).max(200)
const schemaBalises = z.array(z.string().regex(/^[a-z][a-z0-9-]*$/).max(40)).min(1).max(200)
const schemaPosition = z.enum(['avant', 'apres', 'dedans'])
const schemaDev = z.object({
  page: z.string().min(1).max(300),
  chemin: schemaChemin,
  balises: schemaBalises,
  operation: z.discriminatedUnion('op', [
    z.object({ op: z.literal('deplacer-vers'), vers: z.object({ chemin: schemaChemin, balises: schemaBalises }), position: schemaPosition }),
    z.object({ op: z.literal('flags'), flags: z.object({
      'data-bf': nomFlag,
      'data-bf-type': z.enum(['texte', 'riche', 'image', 'lien']).nullable().optional(),
      'data-bf-liste': nomFlag,
      'data-bf-element': z.boolean().optional(),
      'data-bf-limite': z.number().int().nullable().optional(),
      'data-bf-page': nomFlag,
    }) }),
    z.object({ op: z.literal('texte'), valeur: z.string().max(20_000) }),
    z.object({ op: z.literal('attribut'), nom: z.enum(['alt', 'href', 'title', 'class']), valeur: z.string().max(2000).nullable() }),
    z.object({ op: z.literal('supprimer') }),
    z.object({ op: z.literal('dupliquer') }),
    z.object({ op: z.literal('deplacer'), sens: z.enum(['haut', 'bas']) }),
  ]),
})
const libellesDev: Record<string, string> = { 'deplacer-vers': 'déplacé', flags: 'flags', texte: 'texte', attribut: 'attribut', supprimer: 'supprimé', dupliquer: 'dupliqué', deplacer: 'déplacé' }
router.post('/dev', adminMiddleware, action(async (req) => {
  const b = schemaDev.parse(req.body)
  const r = await fichiers.operationDev(sid(req), b.page, { chemin: b.chemin, balises: b.balises }, b.operation)
  journaliser(sid(req), auteur(req), 'mode-dev', `${b.page} · <${b.balises[b.balises.length - 1]}> ${libellesDev[b.operation.op]}`)
  return r
}))

// Mode dev : thème (variables CSS du site et des sections Bifrost)
router.get('/theme', adminMiddleware, action(async (req) => fichiers.lireTheme(sid(req))))
router.put('/theme', adminMiddleware, action(async (req) => {
  const b = z.object({ modifs: z.array(z.object({ fichier: z.string().min(1).max(300), nom: z.string().regex(/^--[a-zA-Z0-9_-]{1,60}$/), valeur: z.string().max(300) })).min(1).max(100) }).parse(req.body)
  const r = await fichiers.ecrireTheme(sid(req), b.modifs)
  journaliser(sid(req), auteur(req), 'mode-dev', `thème : ${b.modifs.map((m) => m.nom).join(', ').slice(0, 200)}`)
  return r
}))

// Mode dev : bibliothèque de sections (blocs fournis + blocs enregistrés par le dev)
router.get('/blocs', adminMiddleware, action(async () => blocs.lister()))
router.post('/blocs/inserer', adminMiddleware, action(async (req) => {
  const b = z.object({
    page: z.string().min(1).max(300),
    bloc: z.string().min(1).max(100),
    position: schemaPosition,
    chemin: schemaChemin.optional(),
    balises: schemaBalises.optional(),
  }).parse(req.body)
  const cible = b.chemin && b.balises ? { chemin: b.chemin, balises: b.balises } : null
  const r = await fichiers.insererBloc(sid(req), b.page, cible, b.position, b.bloc)
  journaliser(sid(req), auteur(req), 'mode-dev', `${b.page} · section « ${b.bloc} » ajoutée`)
  return r
}))
router.post('/blocs', adminMiddleware, action(async (req) => {
  const b = z.object({
    page: z.string().min(1).max(300), chemin: schemaChemin, balises: schemaBalises,
    nom: z.string().trim().min(1).max(60), description: z.string().max(160).optional(),
  }).parse(req.body)
  return fichiers.enregistrerBloc(sid(req), b.page, { chemin: b.chemin, balises: b.balises }, b.nom, b.description)
}))
router.delete('/blocs/:bloc', adminMiddleware, action(async (req) => blocs.supprimer(param(req, 'bloc'))))

// Mode dev : pages du site (créer, renommer, supprimer), menu mis à jour
const schemaPage = z.string().min(1).max(300)
router.post('/pages', adminMiddleware, action(async (req) => {
  const b = z.object({ titre: z.string().trim().min(1).max(120), chemin: schemaPage.optional(), depuis: schemaPage.optional(), menu: z.boolean().default(true) }).parse(req.body)
  const r = await fichiers.creerPage(sid(req), b)
  journaliser(sid(req), auteur(req), 'mode-dev', `page ${r.page} créée`)
  return r
}))
router.put('/pages', adminMiddleware, action(async (req) => {
  const b = z.object({ page: schemaPage, nouveau: schemaPage }).parse(req.body)
  const r = await fichiers.renommerPage(sid(req), b.page, b.nouveau)
  journaliser(sid(req), auteur(req), 'mode-dev', `page ${b.page} renommée en ${r.page}`)
  return r
}))
router.delete('/pages', adminMiddleware, action(async (req) => {
  const { page } = z.object({ page: schemaPage }).parse(req.body)
  const r = await fichiers.supprimerPage(sid(req), page)
  journaliser(sid(req), auteur(req), 'mode-dev', `page ${page} supprimée`)
  return r
}))

// Dev uniquement : importer un dossier de site présent sur le serveur
router.post('/importer', adminMiddleware, action(async (req) => {
  const { dossier } = z.object({ dossier: z.string().min(1) }).parse(req.body)
  return fichiers.importer(sid(req), dossier)
}))

export default router
