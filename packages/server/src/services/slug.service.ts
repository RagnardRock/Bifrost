/** Nom court des sites dans leur adresse publique : /sites/<slug>/ */
import { prisma } from '../config/database'
import { slugifier } from './flags.service'

export const SLUG_VALIDE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/

/** Un nom court libre à partir d'un texte : « ehpad-saint-paulien », puis « -2 », « -3 »… */
export async function slugLibre(texte: string, saufSite?: string) {
  const base = slugifier(texte).slice(0, 55) || 'site'
  for (let n = 1; ; n++) {
    const essai = n === 1 ? base : `${base}-${n}`
    const pris = await prisma.site.findFirst({ where: { slug: essai, NOT: saufSite ? { id: saufSite } : undefined }, select: { id: true } })
    if (!pris) return essai
  }
}

/** Donne un nom court aux sites créés avant cette fonction. */
export async function completerSlugs() {
  const sans = await prisma.site.findMany({ where: { slug: null }, select: { id: true, name: true } })
  for (const s of sans) await prisma.site.update({ where: { id: s.id }, data: { slug: await slugLibre(s.name, s.id) } })
}

// Correspondance nom court → identifiant, gardée 30 secondes (chaque page charge beaucoup de fichiers)
const cache = new Map<string, { id: string | null; jusqua: number }>()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export async function siteParCle(cle: string): Promise<string | null> {
  if (UUID.test(cle)) return cle
  if (!SLUG_VALIDE.test(cle)) return null
  const c = cache.get(cle)
  if (c && c.jusqua > Date.now()) return c.id
  const s = await prisma.site.findUnique({ where: { slug: cle }, select: { id: true } })
  cache.set(cle, { id: s?.id ?? null, jusqua: Date.now() + 30000 })
  return s?.id ?? null
}

export function oublierSlug(slug?: string | null) {
  if (slug) cache.delete(slug)
}
