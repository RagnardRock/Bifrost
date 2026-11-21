/**
 * Comptes des clients (v2) : connexion par e-mail, invitations dans l'équipe d'un site, mot de passe oublié.
 *
 * Un compte = une personne (un e-mail, un mot de passe), membre d'un ou plusieurs sites. Rôle par site :
 * - responsable : modifie, publie, annule une publication, gère l'équipe
 * - redacteur   : modifie le brouillon ; un responsable publie
 */
import crypto from 'crypto'
import { prisma } from '../config/database'
import { config } from '../config'
import { comparePassword, hashPassword } from '../utils/hash'
import { signToken } from '../utils/jwt'
import { Errors } from '../utils/errors'
import { envoyer } from './mail.service'
import { journaliser } from './suivi.service'
import { siteParCle } from './slug.service'
import * as doubleAuth from './double-auth.service'
import * as accesClient from './acces-client.service'

export type Role = 'responsable' | 'redacteur'
export const ROLES: Role[] = ['responsable', 'redacteur']
const DUREE = { invitation: 7 * 24 * 3600 * 1000, reinitialisation: 3600 * 1000 }

const empreinte = (jeton: string) => crypto.createHash('sha256').update(jeton).digest('hex')
const normaliser = (email: string) => email.trim().toLowerCase()
const parEmail = (email: string) => prisma.user.findUnique({ where: { email: normaliser(email) } })

/** Les sites d'une personne, pour la connexion et le menu de l'éditeur. */
export async function mesSites(userId: string) {
  const m = await prisma.membre.findMany({
    where: { userId },
    include: { site: { select: { id: true, name: true, slug: true } } },
    orderBy: { site: { name: 'asc' } },
  })
  return m.map((x) => ({ id: x.site.id, nom: x.site.name, slug: x.site.slug, role: x.role as Role }))
}

function session(user: { id: string; email: string }, site: { id: string; nom: string; slug: string | null; role: Role }) {
  const token = signToken({ userId: user.id, siteId: site.id, role: 'client' })
  return { token, user: { id: user.id, email: user.email, siteId: site.id, role: site.role, site: { id: site.id, name: site.nom, slug: site.slug } } }
}

/**
 * Connexion par e-mail et mot de passe, sans identifiant de site.
 * Si la personne fait partie de plusieurs sites, on renvoie la liste pour qu'elle choisisse.
 */
export async function connexion(email: string, motDePasse: string, cle?: string, code?: string) {
  const user = await parEmail(email)
  if (!user || !(await comparePassword(motDePasse, user.passwordHash))) throw Errors.unauthorized('E-mail ou mot de passe incorrect')
  const sites = await mesSites(user.id)
  if (!sites.length) throw Errors.forbidden('Ce compte ne fait plus partie d’aucune équipe')
  const voulu = cle ? await siteParCle(cle) : null
  const site = sites.find((s) => s.id === voulu) ?? (sites.length === 1 ? sites[0] : null)
  // Double authentification : le code est vérifié avant de montrer la liste des sites,
  // puis consommé quand la session s'ouvre (le même code sert pour les deux étapes)
  await doubleAuth.verifierConnexion('user', user, code, !site)
  if (!site) return { sites: sites.map(({ id, nom }) => ({ id, nom })) }
  return session(user, site)
}

/** Un lien à usage unique : invitation dans un site ou dans tous les sites d'un client, ou nouveau mot de passe. */
async function creerJeton(type: 'invitation' | 'reinitialisation', cible: { siteId?: string; clientId?: string }, email: string, role: Role = 'redacteur') {
  const jeton = crypto.randomBytes(32).toString('base64url')
  await prisma.jeton.create({
    data: { type, siteId: cible.siteId ?? null, clientId: cible.clientId ?? null, email: normaliser(email), role, hash: empreinte(jeton), expireLe: new Date(Date.now() + DUREE[type]) },
  })
  return `${config.appUrl}/acces/${jeton}`
}

/**
 * Invite une personne dans l'équipe d'un site. Renvoie le lien (à transmettre soi-même si l'e-mail n'est pas configuré).
 * Si elle a déjà un compte Bifrost (autre site), elle est ajoutée tout de suite et garde son mot de passe.
 */
export async function inviter(siteId: string, email: string, role: Role, invitePar: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } })
  if (!site) throw Errors.notFound('Site')
  const e = normaliser(email)
  const existant = await parEmail(e)
  if (existant && await prisma.membre.findUnique({ where: { userId_siteId: { userId: existant.id, siteId } } })) {
    throw Errors.conflict('Cette personne fait déjà partie de l’équipe')
  }
  if (existant) {
    await prisma.membre.create({ data: { userId: existant.id, siteId, role } })
    journaliser(siteId, existant.id, 'arrivee', existant.email)
    const lien = `${config.appUrl}/edition/${site.slug || site.id}`
    const envoye = await envoyer(e, `Vous pouvez modifier le site ${site.name}`,
      `Bonjour,\n\n${invitePar} vous a ajouté à l'équipe du site « ${site.name} » sur Bifrost.\n\n` +
      `Connectez-vous avec votre compte habituel :\n${lien}\n`)
    return { lien, envoye, ajoute: true }
  }
  // une seule invitation en cours par adresse
  await prisma.jeton.deleteMany({ where: { siteId, email: e, type: 'invitation', utiliseLe: null } })
  const lien = await creerJeton('invitation', { siteId }, e, role)
  const envoye = await envoyer(e, `Invitation à modifier le site ${site.name}`,
    `Bonjour,\n\n${invitePar} vous invite à modifier le site « ${site.name} » avec Bifrost.\n\n` +
    `Choisissez votre mot de passe en ouvrant ce lien (valable 7 jours) :\n${lien}\n\n` +
    `Si vous ne vous attendiez pas à ce message, ignorez-le.`)
  return { lien, envoye, ajoute: false }
}

/**
 * Invite une personne sur tous les sites d'un client (depuis la fiche client, espace dev).
 * Si elle a déjà un compte, l'accès est donné tout de suite.
 */
export async function inviterClient(clientId: string, email: string, role: Role, invitePar: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, include: { sites: { select: { id: true, name: true, slug: true }, orderBy: { name: 'asc' } } } })
  if (!client) throw Errors.notFound('Client')
  if (!client.sites.length) throw Errors.badRequest('Rattachez d’abord un site à ce client')
  const e = normaliser(email)
  const noms = client.sites.map((s) => `« ${s.name} »`).join(', ')
  const existant = await parEmail(e)
  if (existant && await prisma.accesClient.findUnique({ where: { clientId_userId: { clientId, userId: existant.id } } })) {
    throw Errors.conflict('Cette personne a déjà accès aux sites de ce client')
  }
  if (existant) {
    await accesClient.donnerAcces(clientId, existant.id, role)
    const lien = `${config.appUrl}/edition/${client.sites[0]!.slug || client.sites[0]!.id}`
    const envoye = await envoyer(e, client.sites.length > 1 ? 'Vous pouvez modifier vos sites' : `Vous pouvez modifier le site ${client.sites[0]!.name}`,
      `Bonjour,\n\n${invitePar} vous a donné accès sur Bifrost à : ${noms}.\n\nConnectez-vous avec votre compte habituel :\n${lien}\n`)
    return { lien, envoye, ajoute: true }
  }
  await prisma.jeton.deleteMany({ where: { clientId, email: e, type: 'invitation', utiliseLe: null } })
  const lien = await creerJeton('invitation', { clientId }, e, role)
  const envoye = await envoyer(e, client.sites.length > 1 ? 'Invitation à modifier vos sites' : `Invitation à modifier le site ${client.sites[0]!.name}`,
    `Bonjour,\n\n${invitePar} vous invite à modifier avec Bifrost : ${noms}.\n\n` +
    `Choisissez votre mot de passe en ouvrant ce lien (valable 7 jours) :\n${lien}\n\n` +
    `Si vous ne vous attendiez pas à ce message, ignorez-le.`)
  return { lien, envoye, ajoute: false }
}

export async function annulerInvitationClient(clientId: string, id: string) {
  await prisma.jeton.deleteMany({ where: { id, clientId, type: 'invitation' } })
  return { ok: true }
}

/** Mot de passe oublié : un seul lien, valable pour tous les sites. Toujours la même réponse, pour ne rien révéler. */
export async function oubli(email: string) {
  const user = await parEmail(email)
  const site = user ? (await mesSites(user.id))[0] : undefined
  if (user && site) {
    const lien = await creerJeton('reinitialisation', { siteId: site.id }, user.email)
    await envoyer(user.email, 'Nouveau mot de passe Bifrost',
      `Bonjour,\n\nPour choisir un nouveau mot de passe sur Bifrost, ouvrez ce lien, valable 1 heure :\n${lien}\n\n` +
      `Si vous n'avez rien demandé, ignorez ce message : votre mot de passe reste le même.`)
  }
  return { ok: true }
}

async function jetonValide(jeton: string) {
  const j = await prisma.jeton.findUnique({
    where: { hash: empreinte(jeton) },
    include: { site: { select: { id: true, name: true, slug: true } }, client: { select: { nom: true, sites: { select: { name: true } } } } },
  })
  if (!j || j.utiliseLe || j.expireLe < new Date()) throw Errors.badRequest('Ce lien n’est plus valable. Demandez-en un nouveau.')
  return j
}

export async function lireJeton(jeton: string) {
  const j = await jetonValide(jeton)
  // Invitation par client : « Vroom Performance et Vroom Boutique »
  const noms = j.site ? [j.site.name] : (j.client?.sites ?? []).map((s) => s.name)
  const nom = noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}` : noms[0] ?? ''
  return { type: j.type, email: j.email, site: { nom } }
}

/** Utilise le lien : crée le compte (invitation) ou change le mot de passe, puis connecte la personne. */
export async function utiliserJeton(jeton: string, motDePasse: string) {
  const j = await jetonValide(jeton)
  const passwordHash = await hashPassword(motDePasse)
  const email = normaliser(j.email)
  let user
  if (j.type === 'invitation') {
    user = await prisma.user.upsert({ where: { email }, update: { passwordHash }, create: { email, passwordHash } })
    if (j.clientId) await accesClient.donnerAcces(j.clientId, user.id, j.role)
    else if (j.siteId) {
      await prisma.membre.upsert({
        where: { userId_siteId: { userId: user.id, siteId: j.siteId } },
        update: {},
        create: { userId: user.id, siteId: j.siteId, role: j.role },
      })
    }
  } else {
    const existant = await parEmail(email)
    if (!existant) throw Errors.badRequest('Ce lien n’est plus valable. Demandez-en un nouveau.')
    user = await prisma.user.update({ where: { id: existant.id }, data: { passwordHash } })
  }
  await prisma.jeton.update({ where: { id: j.id }, data: { utiliseLe: new Date() } })
  if (j.siteId) journaliser(j.siteId, user.id, j.type === 'invitation' ? 'arrivee' : 'mot-de-passe', user.email)
  // Double authentification active : le lien ne suffit pas, la personne se connecte avec son code
  if (user.totpActif) return { connexion: true as const, email: user.email }
  const sites = await mesSites(user.id)
  const site = sites.find((s) => s.id === j.siteId) ?? sites[0]
  if (!site) throw Errors.forbidden('Ce compte ne fait plus partie d’aucune équipe')
  return session(user, site)
}

/** Changer son mot de passe depuis « Mon compte » (l'ancien est demandé). */
export async function changerMotDePasse(userId: string, siteId: string | undefined, actuel: string, nouveau: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || !(await comparePassword(actuel, user.passwordHash))) throw Errors.badRequest('Mot de passe actuel incorrect')
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(nouveau) } })
  if (siteId) journaliser(siteId, user.id, 'mot-de-passe', user.email)
  return { change: true }
}

/** Changer de site sans retaper son mot de passe. */
export async function changerDeSite(userId: string, cle: string) {
  const id = await siteParCle(cle)
  const site = (await mesSites(userId)).find((s) => s.id === id)
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!site || !user) throw Errors.forbidden('Vous ne faites pas partie de l’équipe de ce site')
  return session(user, site)
}

// ---------- équipe d'un site ----------
// L'identifiant d'un membre, côté éditeur, est celui de la personne (userId).

export async function equipe(siteId: string) {
  const [membres, invitations] = await Promise.all([
    prisma.membre.findMany({ where: { siteId }, include: { user: { select: { email: true, totpActif: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.jeton.findMany({
      where: { siteId, type: 'invitation', utiliseLe: null, expireLe: { gt: new Date() } },
      select: { id: true, email: true, role: true, expireLe: true }, orderBy: { createdAt: 'desc' },
    }),
  ])
  return { membres: membres.map((m) => ({ id: m.userId, email: m.user.email, role: m.role, createdAt: m.createdAt, doubleAuth: m.user.totpActif, parClient: !!m.parClient })), invitations }
}

async function resteUnResponsable(siteId: string, sauf: string) {
  return (await prisma.membre.count({ where: { siteId, role: 'responsable', userId: { not: sauf } } })) > 0
}

const membre = (siteId: string, userId: string) =>
  prisma.membre.findUnique({ where: { userId_siteId: { userId, siteId } }, include: { user: { select: { email: true } } } })

export async function changerRole(siteId: string, id: string, role: Role) {
  const m = await membre(siteId, id)
  if (!m) throw Errors.notFound('Membre')
  if (m.role === 'responsable' && role !== 'responsable' && !(await resteUnResponsable(siteId, id))) {
    throw Errors.badRequest('Il faut garder au moins un responsable')
  }
  await prisma.membre.update({ where: { id: m.id }, data: { role } })
  return { id, email: m.user.email, role }
}

/** Retire la personne de l'équipe du site ; son compte disparaît s'il ne sert plus à aucun site. */
export async function retirer(siteId: string, id: string, moi: string | null) {
  if (id === moi) throw Errors.badRequest('Vous ne pouvez pas vous retirer vous-même')
  const m = await membre(siteId, id)
  if (!m) throw Errors.notFound('Membre')
  if (m.role === 'responsable' && !(await resteUnResponsable(siteId, id))) throw Errors.badRequest('Il faut garder au moins un responsable')
  await prisma.membre.delete({ where: { id: m.id } })
  if (!(await prisma.membre.count({ where: { userId: id } })) && !(await prisma.accesClient.count({ where: { userId: id } }))) await prisma.user.delete({ where: { id } })
  return { ok: true }
}

export async function annulerInvitation(siteId: string, id: string) {
  await prisma.jeton.deleteMany({ where: { id, siteId, type: 'invitation' } })
  return { ok: true }
}
