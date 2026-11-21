/**
 * Espace dev : fiches clients (contact, contrat) et cycle de vie des sites
 * (pause, export, suppression avec corbeille de 30 jours, restauration).
 */
import { prisma } from '../config/database'
import { logger } from '../utils/logger'
import { Errors } from '../utils/errors'
import * as fichiers from './site-fichiers.service'
import { oublierSlug } from './slug.service'

export const STATUTS = ['essai', 'actif', 'suspendu', 'termine'] as const
export const PERIODES = ['mois', 'an', 'unique'] as const

export interface DonneesClient {
  nom: string
  contactNom?: string | null
  email?: string | null
  telephone?: string | null
  adresse?: string | null
  notes?: string
  statut?: (typeof STATUTS)[number]
  formule?: string | null
  prix?: number | null
  periode?: (typeof PERIODES)[number] | null
  debut?: Date | null
  echeance?: Date | null
}

const sitesResume = { select: { id: true, name: true, slug: true, url: true, enPause: true }, orderBy: { name: 'asc' as const } }

export const lister = () =>
  prisma.client.findMany({ orderBy: { nom: 'asc' }, include: { sites: sitesResume } })

export async function fiche(id: string) {
  const c = await prisma.client.findUnique({ where: { id }, include: { sites: sitesResume } })
  if (!c) throw Errors.notFound('Client')
  return c
}

export const creer = (d: DonneesClient) => prisma.client.create({ data: d, include: { sites: sitesResume } })

export async function modifier(id: string, d: DonneesClient) {
  await fiche(id)
  return prisma.client.update({ where: { id }, data: d, include: { sites: sitesResume } })
}

/** Supprime la fiche. Ses sites restent, sans client. */
export async function supprimer(id: string) {
  await fiche(id)
  await prisma.client.delete({ where: { id } })
}

/** Rattache un site à un client (ou le détache avec null). */
export async function rattacher(siteId: string, clientId: string | null) {
  if (clientId) await fiche(clientId)
  await prisma.site.update({ where: { id: siteId }, data: { clientId } })
}

export async function mettreEnPause(siteId: string, pause: boolean) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } })
  if (!site) throw Errors.notFound('Site')
  await fichiers.mettreEnPause(siteId, site.name, pause)
  await prisma.site.update({ where: { id: siteId }, data: { enPause: pause } })
}

// ---------- suppression et corbeille ----------

/** Supprime un site : fichiers et données partent dans la corbeille pour 30 jours. */
export async function supprimerSite(siteId: string, confirmationNom: string) {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { membres: true, publications: true, evenements: true, messages: true, jetons: true },
  })
  if (!site) throw Errors.notFound('Site')
  if (confirmationNom.trim() !== site.name.trim()) throw Errors.badRequest('Le nom tapé ne correspond pas au nom du site')
  await fichiers.mettreALaCorbeille(site.id, { version: 1, supprimeLe: new Date().toISOString(), site })
  await prisma.site.delete({ where: { id: site.id } })
  oublierSlug(site.slug)
  return { id: site.id }
}

type Sauvegarde = {
  supprimeLe: string
  site: {
    id: string; name: string; url: string; slug: string | null; emailMessages: string | null; apiKey: string
    clientId: string | null; createdAt: string
    membres: { id: string; userId: string; siteId: string; role: string; createdAt: string }[]
    publications: { id: string; auteur: string | null; ajoutes: unknown; modifies: unknown; supprimes: unknown; changements: unknown; annulee: boolean; createdAt: string }[]
    evenements: { id: string; auteur: string | null; type: string; detail: string; createdAt: string }[]
    messages: { id: string; formulaire: string; champs: unknown; email: string | null; lu: boolean; createdAt: string }[]
  }
}

const finCorbeille = (supprimeLe: string) => new Date(new Date(supprimeLe).getTime() + fichiers.JOURS_CORBEILLE * 86400_000)

export async function corbeille() {
  const res: { id: string; nom: string; supprimeLe: string; effaceLe: Date; messages: number }[] = []
  for (const id of await fichiers.listerCorbeille()) {
    try {
      const s = (await fichiers.lireCorbeille(id)) as Sauvegarde
      res.push({ id, nom: s.site.name, supprimeLe: s.supprimeLe, effaceLe: finCorbeille(s.supprimeLe), messages: s.site.messages.length })
    } catch { /* entrée illisible : ignorée */ }
  }
  return res.sort((a, b) => b.supprimeLe.localeCompare(a.supprimeLe))
}

/** Remet un site supprimé : données (équipe, publications, journal, messages) et fichiers. */
export async function restaurerSite(siteId: string) {
  const { site: s } = (await fichiers.lireCorbeille(siteId).catch(() => { throw Errors.notFound('Site supprimé') })) as Sauvegarde
  if (await prisma.site.findUnique({ where: { id: s.id }, select: { id: true } })) throw Errors.badRequest('Ce site existe déjà')
  const slugPris = s.slug ? await prisma.site.findFirst({ where: { slug: s.slug }, select: { id: true } }) : null
  const clientExiste = s.clientId ? await prisma.client.findUnique({ where: { id: s.clientId }, select: { id: true } }) : null
  const users = new Set((await prisma.user.findMany({ where: { id: { in: s.membres.map((m) => m.userId) } }, select: { id: true } })).map((u) => u.id))
  await prisma.$transaction([
    prisma.site.create({ data: {
      id: s.id, name: s.name, url: s.url, slug: slugPris ? null : s.slug, emailMessages: s.emailMessages, apiKey: s.apiKey,
      clientId: clientExiste ? s.clientId : null, createdAt: new Date(s.createdAt),
    } }),
    prisma.membre.createMany({ data: s.membres.filter((m) => users.has(m.userId)).map((m) => ({ id: m.id, userId: m.userId, siteId: s.id, role: m.role, createdAt: new Date(m.createdAt) })) }),
    prisma.publication.createMany({ data: s.publications.map((p) => ({ ...p, siteId: s.id, createdAt: new Date(p.createdAt) })) as any }),
    prisma.evenement.createMany({ data: s.evenements.map((e) => ({ id: e.id, siteId: s.id, auteur: e.auteur, type: e.type, detail: e.detail, createdAt: new Date(e.createdAt) })) }),
    prisma.message.createMany({ data: s.messages.map((m) => ({ id: m.id, siteId: s.id, formulaire: m.formulaire, champs: m.champs as any, email: m.email, lu: m.lu, createdAt: new Date(m.createdAt) })) }),
  ])
  try {
    await fichiers.sortirDeLaCorbeille(s.id)
  } catch (e) {
    await prisma.site.delete({ where: { id: s.id } }) // on revient à l'état d'avant
    throw e
  }
  // Un site supprimé en pause revient sans pause (le marqueur a été rangé avec ses fichiers)
  await fichiers.mettreEnPause(s.id, s.name, false)
  oublierSlug(s.slug)
  return { id: s.id, slug: slugPris ? null : s.slug }
}

/** Efface définitivement ce qui est dans la corbeille depuis plus de 30 jours. */
export async function purgerCorbeille() {
  for (const e of await corbeille()) {
    if (e.effaceLe.getTime() < Date.now()) {
      await fichiers.viderEntreeCorbeille(e.id)
      logger.info({ site: e.id }, 'corbeille : site effacé définitivement')
    }
  }
}

/** Effacement définitif tout de suite (bouton de la corbeille). */
export const effacerDefinitivement = (siteId: string) => fichiers.viderEntreeCorbeille(siteId)
