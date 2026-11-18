/**
 * Suivi côté dev : journal des événements de chaque site et vue d'ensemble de tous les sites.
 */
import { prisma } from '../config/database'
import { logger } from '../utils/logger'
import * as fichiers from './site-fichiers.service'

export type TypeEvenement =
  | 'modification' | 'image' | 'liste' | 'actualite'
  | 'publication' | 'annulation' | 'abandon' | 'import'
  | 'invitation' | 'arrivee' | 'mot-de-passe' | 'role' | 'retrait' | 'message'

/** Ajoute un événement au journal. Ne fait jamais échouer l'action qui l'appelle. */
export function journaliser(siteId: string, auteur: string | null | undefined, type: TypeEvenement, detail = '') {
  prisma.evenement.create({ data: { siteId, auteur: auteur || null, type, detail: detail.slice(0, 300) } })
    .catch((e) => logger.warn({ err: e }, 'journal : événement non enregistré'))
}

/** Adresse e-mail des auteurs (comptes clients ou admins), par identifiant. */
async function emails(ids: (string | null)[]) {
  const uniques = [...new Set(ids.filter((x): x is string => !!x))]
  if (!uniques.length) return new Map<string, string>()
  const [users, admins] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: uniques } }, select: { id: true, email: true } }),
    prisma.admin.findMany({ where: { id: { in: uniques } }, select: { id: true, email: true } }),
  ])
  return new Map<string, string>([...users.map((u) => [u.id, u.email] as const), ...admins.map((a) => [a.id, `${a.email} (dev)`] as const)])
}

async function nbDifferences(siteId: string) {
  try {
    const d = await fichiers.differences(siteId)
    return d.ajoutes.length + d.modifies.length + d.supprimes.length
  } catch {
    return null // site pas encore importé
  }
}

/** Tous les sites, avec ce qu'il faut pour voir d'un coup d'œil où en est chacun. */
export async function sites() {
  const liste = await prisma.site.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, url: true, slug: true, createdAt: true,
      _count: { select: { membres: true } },
      publications: { where: { annulee: false }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, auteur: true } },
      evenements: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, auteur: true, type: true } },
      jetons: { where: { type: 'invitation', utiliseLe: null, expireLe: { gt: new Date() } }, select: { id: true } },
    },
  })
  const qui = await emails(liste.flatMap((s) => [s.publications[0]?.auteur ?? null, s.evenements[0]?.auteur ?? null]))
  return Promise.all(liste.map(async (s) => {
    const pub = s.publications[0]
    const ev = s.evenements[0]
    let pages: number | null = null
    try { pages = (await fichiers.listerPages(s.id)).length } catch { /* pas importé */ }
    return {
      id: s.id,
      nom: s.name,
      url: s.url,
      slug: s.slug,
      pages,
      enAttente: await nbDifferences(s.id),
      membres: s._count.membres,
      invitations: s.jetons.length,
      dernierePublication: pub ? { date: pub.createdAt, auteur: pub.auteur ? qui.get(pub.auteur) || null : null } : null,
      derniereActivite: ev ? { date: ev.createdAt, type: ev.type, auteur: ev.auteur ? qui.get(ev.auteur) || null : null } : null,
    }
  }))
}

/** Journal, de tous les sites ou d'un seul. */
export async function activite(siteId?: string, limite = 100) {
  const evs = await prisma.evenement.findMany({
    where: siteId ? { siteId } : {},
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limite, 1), 500),
    include: { site: { select: { name: true } } },
  })
  const qui = await emails(evs.map((e) => e.auteur))
  return evs.map((e) => ({
    id: e.id, date: e.createdAt, type: e.type, detail: e.detail,
    site: { id: e.siteId, nom: e.site.name },
    auteur: e.auteur ? qui.get(e.auteur) || 'compte supprimé' : null,
  }))
}

/** Fiche d'un site : modifications en attente (détail), publications avec leur auteur. */
export async function site(siteId: string) {
  const s = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, name: true, url: true, slug: true, emailMessages: true, createdAt: true } })
  if (!s) return null
  const pubs = await prisma.publication.findMany({ where: { siteId }, orderBy: { createdAt: 'desc' }, take: 30 })
  const qui = await emails(pubs.map((p) => p.auteur))
  let differences = null
  let pages: string[] = []
  try { differences = await fichiers.differences(siteId); pages = await fichiers.listerPages(siteId) } catch { /* pas importé */ }
  return {
    site: s,
    pages: pages.length,
    differences,
    publications: pubs.map((p) => ({ ...p, auteur: p.auteur ? qui.get(p.auteur) || 'compte supprimé' : null })),
  }
}
