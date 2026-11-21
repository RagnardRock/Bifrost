/**
 * Notifications sur le téléphone (Web Push) : nouveaux messages des formulaires,
 * modifications d'un rédacteur qui attendent d'être publiées.
 *
 * Les clés VAPID sont créées au premier besoin et gardées dans donnees/vapid.json
 * (ou lues dans VAPID_PUBLIQUE / VAPID_PRIVEE). Ne pas les changer ensuite :
 * les appareils déjà abonnés ne recevraient plus rien.
 */
import fs from 'fs/promises'
import path from 'path'
import webpush from 'web-push'
import { prisma } from '../config/database'
import { config } from '../config'
import { logger } from '../utils/logger'

interface Cles { publique: string; privee: string }
let cles: Promise<Cles> | null = null

const fichierCles = () => path.join(path.dirname(config.sitesDir), 'vapid.json')

async function chargerCles(): Promise<Cles> {
  if (process.env.VAPID_PUBLIQUE && process.env.VAPID_PRIVEE) return { publique: process.env.VAPID_PUBLIQUE, privee: process.env.VAPID_PRIVEE }
  try {
    const c = JSON.parse(await fs.readFile(fichierCles(), 'utf-8')) as Cles
    if (c.publique && c.privee) return c
  } catch { /* pas encore créées */ }
  const g = webpush.generateVAPIDKeys()
  const c = { publique: g.publicKey, privee: g.privateKey }
  await fs.mkdir(path.dirname(fichierCles()), { recursive: true })
  await fs.writeFile(fichierCles(), JSON.stringify(c, null, 2), { mode: 0o600 })
  logger.info('notifications : clés VAPID créées')
  return c
}

export function lesCles() {
  if (!cles) cles = chargerCles().catch((e) => { cles = null; throw e })
  return cles
}

/** Le « sujet » VAPID : l'adresse https de Bifrost, sinon une adresse neutre (essais en local). */
const sujet = () => process.env.VAPID_SUJET || (config.appUrl.startsWith('https://') ? config.appUrl : 'mailto:notifications@bifrost.invalid')

export const clePublique = async () => (await lesCles()).publique

// --- Réglages et abonnements d'une personne ---

export async function reglages(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { notifMessages: true, notifAPublier: true, _count: { select: { abonnementsPush: true } } } })
  return { messages: u?.notifMessages ?? true, aPublier: u?.notifAPublier ?? true, appareils: u?._count.abonnementsPush ?? 0, cle: await clePublique() }
}

export async function modifierReglages(userId: string, r: { messages?: boolean; aPublier?: boolean }) {
  await prisma.user.update({ where: { id: userId }, data: { notifMessages: r.messages, notifAPublier: r.aPublier } })
  return reglages(userId)
}

export interface Abonnement { endpoint: string; keys: { p256dh: string; auth: string } }

/** Un appareil s'abonne. Si l'adresse était à quelqu'un d'autre (téléphone partagé), elle change de main. */
export async function abonner(userId: string, a: Abonnement) {
  await prisma.abonnementPush.upsert({
    where: { endpoint: a.endpoint },
    create: { userId, endpoint: a.endpoint, p256dh: a.keys.p256dh, auth: a.keys.auth },
    update: { userId, p256dh: a.keys.p256dh, auth: a.keys.auth },
  })
  return reglages(userId)
}

export async function desabonner(userId: string, endpoint: string) {
  await prisma.abonnementPush.deleteMany({ where: { userId, endpoint } })
  return reglages(userId)
}

// --- Envoi ---

export interface Notification { titre: string; texte: string; url: string; tag?: string }

/** Envoie à tous les appareils de ces personnes. Les abonnements expirés sont retirés. */
export async function envoyerA(userIds: string[], n: Notification) {
  if (!userIds.length) return 0
  const abonnements = await prisma.abonnementPush.findMany({ where: { userId: { in: userIds } } })
  if (!abonnements.length) return 0
  const c = await lesCles()
  const options = { vapidDetails: { subject: sujet(), publicKey: c.publique, privateKey: c.privee }, TTL: 24 * 3600 }
  const charge = JSON.stringify(n)
  let envoyes = 0
  await Promise.all(abonnements.map(async (a) => {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, charge, options)
      envoyes++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await prisma.abonnementPush.delete({ where: { id: a.id } }).catch(() => {})
      else logger.warn({ err: e, code }, 'notifications : envoi impossible')
    }
  }))
  return envoyes
}

/** Responsables d'un site qui veulent ce type de notification (sauf l'auteur de l'action). */
async function responsables(siteId: string, type: 'messages' | 'aPublier', sauf?: string | null) {
  const membres = await prisma.membre.findMany({
    where: { siteId, role: 'responsable', user: type === 'messages' ? { notifMessages: true } : { notifAPublier: true } },
    select: { userId: true },
  })
  return membres.map((m) => m.userId).filter((id) => id !== sauf)
}

const cleSite = async (siteId: string) => {
  const s = await prisma.site.findUnique({ where: { id: siteId }, select: { name: true, slug: true } })
  return { nom: s?.name || 'votre site', cle: s?.slug || siteId }
}

/** Nouveau message reçu par un formulaire. */
export async function nouveauMessage(siteId: string, formulaire: string, extrait: string) {
  try {
    const s = await cleSite(siteId)
    await envoyerA(await responsables(siteId, 'messages'), {
      titre: `Nouveau message · ${s.nom}`,
      texte: extrait ? extrait.slice(0, 140) : `Formulaire « ${formulaire} »`,
      url: `/mon-site/${s.cle}?onglet=messages`,
      tag: `message-${siteId}`,
    })
  } catch (e) {
    logger.warn({ err: e }, 'notifications : nouveau message non signalé')
  }
}

/** Un rédacteur a modifié le site : on prévient les responsables, au plus une fois par heure et par site. */
const dernierAvis = new Map<string, number>()
export const DELAI_A_PUBLIER = 60 * 60 * 1000

export async function modificationsAPublier(siteId: string, auteurId: string | null) {
  const maintenant = Date.now()
  if (maintenant - (dernierAvis.get(siteId) ?? 0) < DELAI_A_PUBLIER) return
  dernierAvis.set(siteId, maintenant)
  try {
    const s = await cleSite(siteId)
    await envoyerA(await responsables(siteId, 'aPublier', auteurId), {
      titre: `Modifications à publier · ${s.nom}`,
      texte: 'Un rédacteur a modifié le site. Relisez puis publiez quand vous voulez.',
      url: `/edition/${s.cle}`,
      tag: `a-publier-${siteId}`,
    })
  } catch (e) {
    logger.warn({ err: e }, 'notifications : modifications non signalées')
  }
}

/** Pour les essais : oublier les délais. */
export const _oublierDelais = () => dernierAvis.clear()
