/**
 * Domaines des clients (monasso.fr) : le site répond directement sur son adresse.
 * Caddy demande à Bifrost si un domaine est à lui avant de créer son certificat HTTPS (« on-demand TLS »),
 * puis lui passe toutes les visites ; Bifrost sert la version en ligne du bon site.
 * Le domaine vient du champ « Adresse de son propre domaine » de la fiche du site (Site.url).
 */
import { prisma } from '../config/database'
import { config } from '../config'

/** « https://www.MonAsso.fr/ » ou « monasso.fr:443 » → « monasso.fr » (www accepté aussi). */
export function normaliser(adresse: string | null | undefined): string | null {
  let h = (adresse || '').trim().toLowerCase()
  if (!h) return null
  try { h = new URL(h.includes('://') ? h : `https://${h}`).hostname } catch { return null }
  h = h.replace(/\.$/, '').replace(/^www\./, '')
  // Un vrai nom de domaine : au moins un point, pas une adresse IP, pas localhost
  if (!/^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h)) return null
  return h
}

const bifrost = () => normaliser(config.appUrl)

// Domaine → site, relu toutes les 30 secondes (chaque page charge beaucoup de fichiers)
let table: { parDomaine: Map<string, string>; jusqua: number } | null = null

async function lireTable() {
  if (table && table.jusqua > Date.now()) return table.parDomaine
  const sites = await prisma.site.findMany({ where: { url: { not: '' } }, select: { id: true, url: true } })
  const parDomaine = new Map<string, string>()
  const propre = bifrost()
  for (const s of sites) {
    const d = normaliser(s.url)
    if (d && d !== propre && !parDomaine.has(d)) parDomaine.set(d, s.id)
  }
  table = { parDomaine, jusqua: Date.now() + 30_000 }
  return parDomaine
}

/** Le site qui répond sur ce domaine (en-tête Host), ou null. */
export async function siteParDomaine(host: string | undefined): Promise<string | null> {
  const d = normaliser(host)
  if (!d || d === bifrost()) return null
  return (await lireTable()).get(d) ?? null
}

/** Caddy : ce domaine mérite-t-il un certificat ? Oui s'il est celui d'un site (avec ou sans www). */
export const autoriser = async (domaine: string | undefined) => (await siteParDomaine(domaine)) !== null

/** Après une modification de fiche : relire tout de suite. */
export const oublierDomaines = () => { table = null }

/**
 * Le domaine d'un site pointe-t-il bien sur ce serveur ? On compare ses adresses IP à celles de Bifrost
 * (lues dans le DNS de l'adresse de Bifrost : aucune adresse de serveur n'est écrite dans le code).
 */
export async function verifier(url: string | null | undefined) {
  const domaine = normaliser(url)
  if (!domaine) return { domaine: null, attendu: [] as string[], principal: [] as string[], www: [] as string[], ok: false }
  const { promises: dns } = await import('dns')
  const ips = (h: string) => dns.resolve4(h).catch(() => [] as string[])
  const [attendu, principal, www] = await Promise.all([ips(bifrost() || ''), ips(domaine), ips(`www.${domaine}`)])
  const bon = (l: string[]) => l.length > 0 && l.every((ip) => attendu.includes(ip))
  return { domaine, attendu, principal, www, ok: bon(principal), wwwOk: bon(www) }
}
