/**
 * Espace dev (v2) : suivi de tous les sites, fiche d'un site, journal d'activité, mise en place d'un site.
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import multer from 'multer'
import { prisma } from '../config/database'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware'
import { Errors } from '../utils/errors'
import { success } from '../utils/response'
import * as suivi from '../services/suivi.service'
import * as fichiers from '../services/site-fichiers.service'
import { slugLibre, SLUG_VALIDE, oublierSlug, siteParCle } from '../services/slug.service'

const router = Router()
router.use(authMiddleware, adminMiddleware)

const action = (fn: (req: Request) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req).then((d) => res.json(success(d))).catch(next)
const id = (req: Request) => String((req.params as Record<string, string>).id)

router.get('/sites', action(async () => suivi.sites()))

// Site envoyé depuis le navigateur : un ZIP (un dossier glissé est zippé par le navigateur)
const envoi = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024, files: 1 } }).single('archive')
const messageImport = (e: any) => /^(Le dossier|Dossier|Ce fichier|Aucune page)/.test(e?.message || '') ? e.message : 'Envoi illisible'

router.post('/sites/envoi', envoi, action(async (req) => {
  if (!req.file) throw Errors.badRequest('Aucun fichier reçu')
  const b = z.object({ nom: z.string().trim().min(1).max(120), url: z.string().trim().max(300).default('') }).parse(req.body)
  const site = await prisma.site.create({ data: { name: b.nom, url: b.url, slug: await slugLibre(b.nom), apiKey: `bf_${nanoid(32)}` } })
  try {
    const { pages } = await fichiers.importerZip(site.id, req.file.buffer)
    suivi.journaliser(site.id, req.user?.adminId, 'import', `${pages.length} pages`)
    return { id: site.id, pages: pages.length }
  } catch (e: any) {
    await prisma.site.delete({ where: { id: site.id } })
    throw Errors.badRequest(messageImport(e))
  }
}))

router.post('/sites/:id/envoi', envoi, action(async (req) => {
  if (!req.file) throw Errors.badRequest('Aucun fichier reçu')
  // On vérifie l'archive avant d'écraser quoi que ce soit
  const r = await fichiers.importerZip(id(req), req.file.buffer).catch((e) => { throw Errors.badRequest(messageImport(e)) })
  suivi.journaliser(id(req), req.user?.adminId, 'import', `${r.pages.length} pages (réimport)`)
  return r
}))

// Nouveau site : on le crée et on importe son dossier (chemin sur la machine qui fait tourner le serveur)
router.post('/sites', action(async (req) => {
  const b = z.object({ nom: z.string().trim().min(1).max(120), url: z.string().trim().max(300).default(''), dossier: z.string().trim().min(1) }).parse(req.body)
  const site = await prisma.site.create({ data: { name: b.nom, url: b.url, slug: await slugLibre(b.nom), apiKey: `bf_${nanoid(32)}` } })
  try {
    const { pages } = await fichiers.importer(site.id, b.dossier)
    suivi.journaliser(site.id, req.user?.adminId, 'import', `${pages.length} pages`)
    return { id: site.id, pages: pages.length }
  } catch (e: any) {
    await prisma.site.delete({ where: { id: site.id } })
    throw Errors.badRequest(e?.message?.startsWith('Le dossier') || e?.message?.startsWith('Dossier') ? e.message : 'Dossier illisible sur le serveur')
  }
}))

router.put('/sites/:id', action(async (req) => {
  const b = z.object({
    nom: z.string().trim().min(1).max(120),
    url: z.string().trim().max(300),
    slug: z.string().trim().toLowerCase().regex(SLUG_VALIDE, 'Nom court : lettres minuscules, chiffres et tirets').optional(),
  }).parse(req.body)
  const avant = await prisma.site.findUnique({ where: { id: id(req) }, select: { slug: true } })
  if (b.slug && b.slug !== avant?.slug && await prisma.site.findFirst({ where: { slug: b.slug }, select: { id: true } })) {
    throw Errors.badRequest('Ce nom court est déjà pris par un autre site')
  }
  oublierSlug(avant?.slug)
  return prisma.site.update({ where: { id: id(req) }, data: { name: b.nom, url: b.url, ...(b.slug ? { slug: b.slug } : {}) }, select: { id: true, name: true, url: true, slug: true } })
}))

// Réimporter le dossier du site (écrase brouillon et version en ligne)
router.post('/sites/:id/importer', action(async (req) => {
  const { dossier } = z.object({ dossier: z.string().trim().min(1) }).parse(req.body)
  try {
    const r = await fichiers.importer(id(req), dossier)
    suivi.journaliser(id(req), req.user?.adminId, 'import', `${r.pages.length} pages (réimport)`)
    return r
  } catch (e: any) {
    throw Errors.badRequest(e?.message?.startsWith('Le dossier') || e?.message?.startsWith('Dossier') ? e.message : 'Dossier illisible sur le serveur')
  }
}))

router.get('/sites/:id', action(async (req) => {
  const cle = await siteParCle(id(req))
  const f = cle ? await suivi.site(cle) : null
  if (!f) throw Errors.notFound('Site')
  return f
}))

router.get('/activite', action(async (req) => {
  const q = z.object({ site: z.string().uuid().optional(), limite: z.coerce.number().int().optional() }).parse(req.query)
  return suivi.activite(q.site, q.limite)
}))

export default router
