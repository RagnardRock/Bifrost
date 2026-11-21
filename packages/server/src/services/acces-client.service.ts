/**
 * Accès par client : une personne invitée depuis la fiche client fait partie de l'équipe
 * de tous les sites de ce client, y compris ceux rattachés plus tard.
 *
 * Ces adhésions portent `parClient` : elles partent avec l'accès (ou quand le site est détaché).
 * Une personne déjà membre d'un site à titre personnel (invitée sur ce site) le reste.
 */
import { prisma } from '../config/database'
import { journaliser } from './suivi.service'

/** Donne (ou met à jour) l'accès d'une personne à tous les sites d'un client. */
export async function donnerAcces(clientId: string, userId: string, role: string) {
  await prisma.accesClient.upsert({
    where: { clientId_userId: { clientId, userId } },
    create: { clientId, userId, role },
    update: { role },
  })
  const sites = await prisma.site.findMany({ where: { clientId }, select: { id: true } })
  for (const s of sites) await ajouterAuSite(s.id, clientId, userId, role)
  return sites.length
}

async function ajouterAuSite(siteId: string, clientId: string, userId: string, role: string) {
  const m = await prisma.membre.findUnique({ where: { userId_siteId: { userId, siteId } } })
  if (!m) {
    await prisma.membre.create({ data: { userId, siteId, role, parClient: clientId } })
    journaliser(siteId, userId, 'arrivee', 'accès client')
  } else if (m.parClient === clientId && m.role !== role) {
    await prisma.membre.update({ where: { id: m.id }, data: { role } })
  }
}

/** Change le rôle sur tous les sites du client (seulement les adhésions venues de cet accès). */
export async function changerRole(clientId: string, userId: string, role: string) {
  await prisma.accesClient.update({ where: { clientId_userId: { clientId, userId } }, data: { role } })
  await prisma.membre.updateMany({ where: { userId, parClient: clientId }, data: { role } })
}

/** Retire l'accès : la personne quitte les sites du client où elle était par cet accès. Son compte part s'il ne sert plus. */
export async function retirer(clientId: string, userId: string) {
  await prisma.accesClient.deleteMany({ where: { clientId, userId } })
  await prisma.membre.deleteMany({ where: { userId, parClient: clientId } })
  const reste = await prisma.membre.count({ where: { userId } }) + await prisma.accesClient.count({ where: { userId } })
  if (!reste) await prisma.user.delete({ where: { id: userId } }).catch(() => {})
}

/** Un site change de client : on retire les accès de l'ancien, on donne ceux du nouveau. */
export async function siteRattache(siteId: string, ancien: string | null, nouveau: string | null) {
  if (ancien === nouveau) return
  if (ancien) await prisma.membre.deleteMany({ where: { siteId, parClient: ancien } })
  if (nouveau) {
    const acces = await prisma.accesClient.findMany({ where: { clientId: nouveau } })
    for (const a of acces) await ajouterAuSite(siteId, nouveau, a.userId, a.role)
  }
}

/** La fiche client est supprimée : les personnes restent dans les équipes, à titre personnel. */
export async function clientSupprime(clientId: string) {
  await prisma.membre.updateMany({ where: { parClient: clientId }, data: { parClient: null } })
}

/** Les accès d'un client, et les invitations en attente, pour sa fiche. */
export async function lister(clientId: string) {
  const [acces, invitations] = await Promise.all([
    prisma.accesClient.findMany({ where: { clientId }, include: { user: { select: { email: true, totpActif: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.jeton.findMany({
      where: { clientId, type: 'invitation', utiliseLe: null, expireLe: { gt: new Date() } },
      select: { id: true, email: true, role: true, expireLe: true }, orderBy: { createdAt: 'desc' },
    }),
  ])
  return {
    acces: acces.map((a) => ({ id: a.userId, email: a.user.email, role: a.role, doubleAuth: a.user.totpActif, createdAt: a.createdAt })),
    invitations,
  }
}
