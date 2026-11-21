/**
 * Réseaux sociaux : les posts Instagram d'un client deviennent des actualités de son site.
 *
 * - Le client relie son compte Instagram (professionnel ou créateur) depuis Mon site › Réseaux.
 * - Toutes les 30 minutes, Bifrost regarde s'il y a de nouveaux posts (Instagram ne prévient pas).
 * - Chaque nouveau post devient un élément de la collection choisie (titre, date, texte, photos
 *   copiées sur le site) : en brouillon (un responsable relit et publie) ou publié tout de suite.
 *
 * Il faut une appli Meta (« API Instagram avec connexion Instagram ») : INSTAGRAM_APP_ID et
 * INSTAGRAM_APP_SECRET dans le .env, voir deploy/LISEZMOI.md.
 */
import jwt from 'jsonwebtoken'
import { prisma } from '../config/database'
import { config } from '../config'
import { logger } from '../utils/logger'
import { Errors, AppError } from '../utils/errors'
import * as fichiers from './site-fichiers.service'
import { chiffrer, dechiffrer } from './totp'
import { journaliser } from './suivi.service'
import { publierSite } from './publication.service'
import { postsAPublier } from './notifications.service'

// Adresses d'Instagram (remplaçables pour les essais avec un faux Instagram)
const API = () => process.env.INSTAGRAM_API_URL || 'https://api.instagram.com'
const GRAPH = () => process.env.INSTAGRAM_GRAPH_URL || 'https://graph.instagram.com'
const AUTORISER = () => process.env.INSTAGRAM_AUTORISER_URL || 'https://www.instagram.com/oauth/authorize'
const VERSION = 'v21.0'

export const instagramConfigure = () => !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET)
const adresseRetour = () => `${config.appUrl}/api/reseaux/instagram/retour`
const graine = () => `reseaux:${process.env.DEUX_FACTEURS_CLE || config.jwtSecret}`

// ---------- appels à Instagram ----------

async function appel<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) })
  const corps = await r.json().catch(() => ({})) as { error?: { message?: string } | string; error_message?: string }
  if (!r.ok) {
    const msg = typeof corps.error === 'string' ? corps.error_message || corps.error : corps.error?.message || `HTTP ${r.status}`
    throw Object.assign(new Error(`Instagram : ${msg}`), { statut: r.status })
  }
  return corps as T
}

export interface Post {
  id: string
  caption?: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp: string
  children?: { data: { media_type: string; media_url?: string; thumbnail_url?: string }[] }
}

const CHAMPS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}'

const derniersPosts = (jeton: string, nombre = 25) =>
  appel<{ data: Post[] }>(`${GRAPH()}/${VERSION}/me/media?fields=${encodeURIComponent(CHAMPS)}&limit=${nombre}&access_token=${encodeURIComponent(jeton)}`)
    .then((r) => r.data || [])

// ---------- relier un compte ----------

/** Adresse où envoyer le responsable pour autoriser Bifrost à lire ses posts. */
export function adresseConnexion(siteId: string, userId: string | null) {
  if (!instagramConfigure()) throw Errors.badRequest('Instagram n’est pas encore configuré sur ce serveur')
  const etat = jwt.sign({ siteId, userId, but: 'instagram' }, config.jwtSecret, { expiresIn: '15m' })
  const p = new URLSearchParams({ client_id: process.env.INSTAGRAM_APP_ID!, redirect_uri: adresseRetour(), response_type: 'code', scope: 'instagram_business_basic', state: etat })
  return `${AUTORISER()}?${p}`
}

/** Retour d'Instagram après l'autorisation : jeton longue durée, compte enregistré. Renvoie l'adresse où revenir. */
export async function retourConnexion(code: string | undefined, etat: string | undefined, refus?: string) {
  let e: { siteId: string; userId: string | null; but: string }
  try { e = jwt.verify(String(etat || ''), config.jwtSecret) as typeof e } catch { throw Errors.badRequest('Lien expiré : recommencez depuis Bifrost') }
  if (e.but !== 'instagram') throw Errors.badRequest('Lien invalide')
  const site = await prisma.site.findUnique({ where: { id: e.siteId }, select: { slug: true } })
  const retour = (r: string) => `/mon-site/${site?.slug || e.siteId}?onglet=reseaux&instagram=${r}`
  if (refus || !code) return retour('refus')
  try {
    const court = await appel<{ access_token: string; user_id: string | number }>(`${API()}/oauth/access_token`, {
      method: 'POST',
      body: new URLSearchParams({ client_id: process.env.INSTAGRAM_APP_ID!, client_secret: process.env.INSTAGRAM_APP_SECRET!, grant_type: 'authorization_code', redirect_uri: adresseRetour(), code: code.replace(/#_$/, '') }),
    })
    const long = await appel<{ access_token: string; expires_in: number }>(
      `${GRAPH()}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(process.env.INSTAGRAM_APP_SECRET!)}&access_token=${encodeURIComponent(court.access_token)}`)
    const moi = await appel<{ user_id?: string; id: string; username: string }>(`${GRAPH()}/${VERSION}/me?fields=user_id,username&access_token=${encodeURIComponent(long.access_token)}`)
    const donnees = {
      compteId: String(moi.user_id || moi.id || court.user_id),
      nom: moi.username,
      jeton: chiffrer(long.access_token, graine()),
      expireLe: new Date(Date.now() + (long.expires_in || 60 * 86400) * 1000),
      erreur: null,
    }
    const existant = await prisma.compteReseau.findUnique({ where: { siteId_reseau: { siteId: e.siteId, reseau: 'instagram' } } })
    if (existant) {
      // Un autre compte Instagram : on repart de zéro pour les posts déjà importés
      if (existant.compteId !== donnees.compteId) await prisma.postImporte.deleteMany({ where: { compteId: existant.id } })
      await prisma.compteReseau.update({ where: { id: existant.id }, data: existant.compteId === donnees.compteId ? donnees : { ...donnees, depuis: new Date() } })
    } else {
      const cols = await fichiers.listerCollections(e.siteId)
      await prisma.compteReseau.create({ data: { ...donnees, siteId: e.siteId, reseau: 'instagram', collection: cols[0] || '' } })
    }
    journaliser(e.siteId, e.userId, 'reseau', `Instagram @${moi.username} relié`)
    return retour('ok')
  } catch (err) {
    logger.warn({ err }, 'instagram : connexion impossible')
    return retour('erreur')
  }
}

// ---------- réglages ----------

const vue = (c: { id: string; reseau: string; nom: string; collection: string; mode: string; depuis: Date; derniereVerif: Date | null; erreur: string | null; expireLe: Date }) =>
  ({ id: c.id, reseau: c.reseau, nom: c.nom, collection: c.collection, mode: c.mode, depuis: c.depuis, derniereVerif: c.derniereVerif, erreur: c.erreur, expireLe: c.expireLe })

export async function etat(siteId: string) {
  const comptes = await prisma.compteReseau.findMany({ where: { siteId } })
  return {
    instagram: { configure: instagramConfigure(), compte: comptes.find((c) => c.reseau === 'instagram') ? vue(comptes.find((c) => c.reseau === 'instagram')!) : null },
    collections: await fichiers.listerCollections(siteId),
  }
}

async function compteDuSite(siteId: string, id: string) {
  const c = await prisma.compteReseau.findFirst({ where: { id, siteId } })
  if (!c) throw Errors.notFound('Compte')
  return c
}

export async function regler(siteId: string, id: string, r: { collection?: string; mode?: 'brouillon' | 'publier' }) {
  await compteDuSite(siteId, id)
  if (r.collection !== undefined && !(await fichiers.listerCollections(siteId)).includes(r.collection)) throw Errors.badRequest('Cette rubrique n’existe pas sur le site')
  return vue(await prisma.compteReseau.update({ where: { id }, data: { collection: r.collection, mode: r.mode } }))
}

export async function delier(siteId: string, id: string, userId: string | null) {
  const c = await compteDuSite(siteId, id)
  await prisma.compteReseau.delete({ where: { id } })
  journaliser(siteId, userId, 'reseau', `Instagram @${c.nom} détaché`)
  return { ok: true }
}

// ---------- import des posts ----------

const echapper = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Ce que devient un post : titre (première ligne), texte en paragraphes, date, images à copier. */
export function versElement(p: Post) {
  const legende = (p.caption || '').replace(/\r/g, '').trim()
  const premiere = legende.split('\n').find((l) => l.trim())?.trim() || ''
  // Titre : la première ligne sans les #mots-clés, coupée proprement
  let titre = premiere.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, '').replace(/\s+/g, ' ').trim()
  if (titre.length > 80) titre = titre.slice(0, 80).replace(/\s+\S*$/, '') + '…'
  const date = p.timestamp.slice(0, 10)
  if (!titre) titre = `Publication du ${date.split('-').reverse().join('/')}`
  // Le texte : la légende sans la ligne devenue titre, ni les lignes faites seulement de #mots-clés
  const lignes = legende.split('\n')
  // (une première ligne coupée dans le titre reste aussi dans le texte, en entier)
  if (premiere && !titre.endsWith('…') && titre !== `Publication du ${date.split('-').reverse().join('/')}`) lignes.splice(lignes.findIndex((l) => l.trim()), 1)
  const paragraphes = lignes.filter((l) => !/^\s*(#[\p{L}\p{N}_]+\s*)+$/u.test(l)).join('\n')
    .split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
    .map((b) => `<p>${echapper(b).replace(/\n/g, '<br>')}</p>`)
  const source = p.permalink?.startsWith('https://') ? { url: p.permalink, libelle: 'Voir sur Instagram' } : undefined
  const image = (m: { media_type: string; media_url?: string; thumbnail_url?: string }) => (m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url) || null
  const images = (p.media_type === 'CAROUSEL_ALBUM' && p.children?.data?.length ? p.children.data.map(image) : [image(p)])
    .filter((u): u is string => !!u && u.startsWith('https://')).slice(0, 10)
  return { titre, date, texte: paragraphes.join('\n'), images, source }
}

async function telecharger(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!r.ok) throw new Error(`image ${r.status}`)
  const b = Buffer.from(await r.arrayBuffer())
  if (b.length > 30 * 1024 * 1024) throw new Error('image trop lourde')
  return b
}

type Compte = NonNullable<Awaited<ReturnType<typeof prisma.compteReseau.findFirst>>>

/** Renouvelle le jeton s'il expire dans moins de 10 jours (il dure 60 jours). */
async function jetonValide(c: Compte) {
  let jeton = dechiffrer(c.jeton, graine())
  if (c.expireLe.getTime() - Date.now() < 10 * 86400_000) {
    const r = await appel<{ access_token: string; expires_in: number }>(`${GRAPH()}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(jeton)}`)
    jeton = r.access_token
    await prisma.compteReseau.update({ where: { id: c.id }, data: { jeton: chiffrer(jeton, graine()), expireLe: new Date(Date.now() + r.expires_in * 1000) } })
  }
  return jeton
}

/**
 * Importe les nouveaux posts d'un compte. `recents` : importer aussi les N derniers posts
 * publiés avant la connexion (bouton « Importer les derniers posts »).
 */
const enCours = new Set<string>()

export async function importer(c: Compte, options: { recents?: number; auteur?: string | null } = {}) {
  if (!c.collection) throw Errors.badRequest('Choisissez d’abord la rubrique où mettre les posts')
  // Un seul import à la fois par compte (vérification automatique et bouton en même temps)
  if (enCours.has(c.id)) return { importes: 0, publie: false, pages: [] as string[] }
  enCours.add(c.id)
  try {
    const jeton = await jetonValide(c)
    const deja = new Set((await prisma.postImporte.findMany({ where: { compteId: c.id }, select: { postId: true } })).map((p) => p.postId))
    const posts = await derniersPosts(jeton, Math.max(25, options.recents || 0))
    const recents = new Set(posts.slice(0, options.recents || 0).map((p) => p.id))
    // Du plus ancien au plus récent : le dernier post se retrouve en tête de la liste
    const aFaire = posts.filter((p) => !deja.has(p.id) && (recents.has(p.id) || new Date(p.timestamp) > c.depuis)).reverse()
    // Pour publier tout de suite, le brouillon ne doit rien contenir d'autre (on ne publie pas le travail en cours de quelqu'un)
    const brouillonVide = !(await fichiers.changements(c.siteId)).length
    const pages: string[] = []
    for (const p of aFaire) {
      const e = versElement(p)
      const photos: string[] = []
      for (const url of e.images) {
        try { photos.push(await fichiers.enregistrerImage(c.siteId, await telecharger(url))) } catch (err) { logger.warn({ err, post: p.id }, 'instagram : image non copiée') }
      }
      const { page } = await fichiers.nouvelElement(c.siteId, c.collection, { titre: e.titre, date: e.date, texte: e.texte, photos, source: e.source })
      await prisma.postImporte.create({ data: { compteId: c.id, postId: p.id, page } })
      journaliser(c.siteId, options.auteur ?? null, 'actualite', `Instagram : ${e.titre}`)
      pages.push(page)
    }
    let publie = false
    if (pages.length && c.mode === 'publier' && brouillonVide) publie = !!(await publierSite(c.siteId, options.auteur ?? null))
    else if (pages.length) void postsAPublier(c.siteId, pages.length)
    await prisma.compteReseau.update({ where: { id: c.id }, data: { derniereVerif: new Date(), erreur: null } })
    return { importes: pages.length, publie, pages }
  } catch (err) {
    const statut = (err as { statut?: number }).statut
    const msg = err instanceof AppError ? err.message
      : statut === 400 || statut === 401 || statut === 403 ? 'Instagram refuse l’accès : reliez à nouveau le compte.'
      : 'Instagram ne répond pas, nouvel essai dans 30 minutes.'
    await prisma.compteReseau.update({ where: { id: c.id }, data: { derniereVerif: new Date(), erreur: msg } }).catch(() => {})
    if (!(err instanceof AppError)) logger.warn({ err, compte: c.id }, 'instagram : import impossible')
    throw err instanceof AppError ? err : Errors.badRequest(msg)
  } finally {
    enCours.delete(c.id)
  }
}

export async function importerMaintenant(siteId: string, id: string, recents: number | undefined, auteur: string | null) {
  return importer(await compteDuSite(siteId, id), { recents, auteur })
}

/** Toutes les 30 minutes : chaque compte relié (sites en pause exceptés). */
export async function verifierTous() {
  if (!instagramConfigure()) return
  const comptes = await prisma.compteReseau.findMany({ where: { reseau: 'instagram', collection: { not: '' }, site: { enPause: false } } })
  for (const c of comptes) await importer(c).catch(() => { /* erreur gardée sur le compte */ })
}
