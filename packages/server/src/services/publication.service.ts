/** Publier le brouillon d'un site (bouton « Publier », ou import automatique d'un post). */
import { prisma } from '../config/database'
import * as fichiers from './site-fichiers.service'
import { journaliser } from './suivi.service'

export async function publierSite(siteId: string, auteur: string | null) {
  const pub = await prisma.publication.create({ data: { siteId, auteur, ajoutes: [], modifies: [], supprimes: [] } })
  const avant = await fichiers.differences(siteId)
  const changements = await fichiers.changements(siteId, avant)
  const diff = await fichiers.publier(siteId, pub.id)
  if (!diff.ajoutes.length && !diff.modifies.length && !diff.supprimes.length) {
    await prisma.publication.delete({ where: { id: pub.id } })
    return null
  }
  journaliser(siteId, auteur, 'publication', `${changements.length} modification(s)`)
  return prisma.publication.update({ where: { id: pub.id }, data: { ...diff, changements: changements as never } })
}
