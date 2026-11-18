/**
 * Comptes des clients (v2) : connexion par e-mail, invitations dans l'équipe d'un site, mot de passe oublié.
 *
 * Un compte = une personne sur un site. Rôles :
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

export type Role = 'responsable' | 'redacteur'
export const ROLES: Role[] = ['responsable', 'redacteur']
const DUREE = { invitation: 7 * 24 * 3600 * 1000, reinitialisation: 3600 * 1000 }

const empreinte = (jeton: string) => crypto.createHash('sha256').update(jeton).digest('hex')
const normaliser = (email: string) => email.trim().toLowerCase()

function session(user: { id: string; email: string; siteId: string; role: string }, site: { id: string; name: string }) {
  const token = signToken({ userId: user.id, siteId: user.siteId, role: 'client' })
  return { token, user: { id: user.id, email: user.email, siteId: user.siteId, role: user.role, site: { id: site.id, name: site.name } } }
}

/**
 * Connexion par e-mail et mot de passe, sans identifiant de site.
 * Si la personne a un compte sur plusieurs sites avec ce mot de passe, on renvoie la liste pour qu'elle choisisse.
 */
export async function connexion(email: string, motDePasse: string, siteId?: string) {
  const comptes = await prisma.user.findMany({
    where: { email: { equals: normaliser(email), mode: 'insensitive' }, ...(siteId ? { siteId } : {}) },
    include: { site: { select: { id: true, name: true } } },
  })
  const valides = []
  for (const c of comptes) if (await comparePassword(motDePasse, c.passwordHash)) valides.push(c)
  if (!valides.length) throw Errors.unauthorized('E-mail ou mot de passe incorrect')
  if (valides.length > 1) return { sites: valides.map((c) => ({ id: c.site.id, nom: c.site.name })) }
  return session(valides[0]!, valides[0]!.site)
}

async function creerJeton(type: 'invitation' | 'reinitialisation', siteId: string, email: string, role: Role = 'redacteur') {
  const jeton = crypto.randomBytes(32).toString('base64url')
  await prisma.jeton.create({
    data: { type, siteId, email: normaliser(email), role, hash: empreinte(jeton), expireLe: new Date(Date.now() + DUREE[type]) },
  })
  return `${config.appUrl}/acces/${jeton}`
}

/** Invite une personne dans l'équipe d'un site. Renvoie le lien (à transmettre soi-même si l'e-mail n'est pas configuré). */
export async function inviter(siteId: string, email: string, role: Role, invitePar: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } })
  if (!site) throw Errors.notFound('Site')
  const e = normaliser(email)
  if (await prisma.user.findFirst({ where: { siteId, email: { equals: e, mode: 'insensitive' } } })) {
    throw Errors.conflict('Cette personne fait déjà partie de l’équipe')
  }
  // une seule invitation en cours par adresse
  await prisma.jeton.deleteMany({ where: { siteId, email: e, type: 'invitation', utiliseLe: null } })
  const lien = await creerJeton('invitation', siteId, e, role)
  const envoye = await envoyer(e, `Invitation à modifier le site ${site.name}`,
    `Bonjour,\n\n${invitePar} vous invite à modifier le site « ${site.name} » avec Bifrost.\n\n` +
    `Choisissez votre mot de passe en ouvrant ce lien (valable 7 jours) :\n${lien}\n\n` +
    `Si vous ne vous attendiez pas à ce message, ignorez-le.`)
  return { lien, envoye }
}

/** Mot de passe oublié : un lien par site où l'adresse a un compte. Toujours la même réponse, pour ne rien révéler. */
export async function oubli(email: string) {
  const comptes = await prisma.user.findMany({
    where: { email: { equals: normaliser(email), mode: 'insensitive' } },
    include: { site: { select: { name: true } } },
  })
  for (const c of comptes) {
    const lien = await creerJeton('reinitialisation', c.siteId, c.email)
    await envoyer(c.email, `Nouveau mot de passe pour ${c.site.name}`,
      `Bonjour,\n\nPour choisir un nouveau mot de passe sur Bifrost (site « ${c.site.name} »), ouvrez ce lien, valable 1 heure :\n${lien}\n\n` +
      `Si vous n'avez rien demandé, ignorez ce message : votre mot de passe reste le même.`)
  }
  return { ok: true }
}

async function jetonValide(jeton: string) {
  const j = await prisma.jeton.findUnique({ where: { hash: empreinte(jeton) }, include: { site: { select: { id: true, name: true } } } })
  if (!j || j.utiliseLe || j.expireLe < new Date()) throw Errors.badRequest('Ce lien n’est plus valable. Demandez-en un nouveau.')
  return j
}

export async function lireJeton(jeton: string) {
  const j = await jetonValide(jeton)
  return { type: j.type, email: j.email, site: { nom: j.site.name } }
}

/** Utilise le lien : crée le compte (invitation) ou change le mot de passe, puis connecte la personne. */
export async function utiliserJeton(jeton: string, motDePasse: string) {
  const j = await jetonValide(jeton)
  const passwordHash = await hashPassword(motDePasse)
  let user
  if (j.type === 'invitation') {
    user = await prisma.user.upsert({
      where: { siteId_email: { siteId: j.siteId, email: j.email } },
      update: { passwordHash },
      create: { siteId: j.siteId, email: j.email, passwordHash, role: j.role },
    })
  } else {
    const existant = await prisma.user.findFirst({ where: { siteId: j.siteId, email: { equals: j.email, mode: 'insensitive' } } })
    if (!existant) throw Errors.badRequest('Ce lien n’est plus valable. Demandez-en un nouveau.')
    user = await prisma.user.update({ where: { id: existant.id }, data: { passwordHash } })
  }
  await prisma.jeton.update({ where: { id: j.id }, data: { utiliseLe: new Date() } })
  return session(user, j.site)
}

// ---------- équipe d'un site ----------

export async function equipe(siteId: string) {
  const [membres, invitations] = await Promise.all([
    prisma.user.findMany({ where: { siteId }, select: { id: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
    prisma.jeton.findMany({
      where: { siteId, type: 'invitation', utiliseLe: null, expireLe: { gt: new Date() } },
      select: { id: true, email: true, role: true, expireLe: true }, orderBy: { createdAt: 'desc' },
    }),
  ])
  return { membres, invitations }
}

async function resteUnResponsable(siteId: string, sauf: string) {
  return (await prisma.user.count({ where: { siteId, role: 'responsable', id: { not: sauf } } })) > 0
}

export async function changerRole(siteId: string, id: string, role: Role) {
  const u = await prisma.user.findFirst({ where: { id, siteId } })
  if (!u) throw Errors.notFound('Membre')
  if (u.role === 'responsable' && role !== 'responsable' && !(await resteUnResponsable(siteId, id))) {
    throw Errors.badRequest('Il faut garder au moins un responsable')
  }
  return prisma.user.update({ where: { id }, data: { role }, select: { id: true, email: true, role: true } })
}

export async function retirer(siteId: string, id: string, moi: string | null) {
  if (id === moi) throw Errors.badRequest('Vous ne pouvez pas vous retirer vous-même')
  const u = await prisma.user.findFirst({ where: { id, siteId } })
  if (!u) throw Errors.notFound('Membre')
  if (u.role === 'responsable' && !(await resteUnResponsable(siteId, id))) throw Errors.badRequest('Il faut garder au moins un responsable')
  await prisma.user.delete({ where: { id } })
  return { ok: true }
}

export async function annulerInvitation(siteId: string, id: string) {
  await prisma.jeton.deleteMany({ where: { id, siteId, type: 'invitation' } })
  return { ok: true }
}
