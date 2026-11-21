/**
 * Double authentification des comptes (clients et dev) : code à 6 chiffres d'une appli
 * (Google Authenticator, Microsoft Authenticator, 2FAS, Aegis…) ou code de secours à usage unique.
 */
import { prisma } from '../config/database'
import { config } from '../config'
import { AppError, Errors } from '../utils/errors'
import { comparePassword } from '../utils/hash'
import * as totp from './totp'

export type Genre = 'user' | 'admin'

interface Compte {
  id: string
  email: string
  passwordHash: string
  totpSecret: string | null
  totpActif: boolean
  totpDernier: number | null
  codesSecours: string[]
}

// Clé de chiffrement des secrets : DEUX_FACTEURS_CLE, sinon le secret des sessions
const graine = () => process.env.DEUX_FACTEURS_CLE || config.jwtSecret

async function lire(genre: Genre, id: string): Promise<Compte> {
  const c = genre === 'user' ? await prisma.user.findUnique({ where: { id } }) : await prisma.admin.findUnique({ where: { id } })
  if (!c) throw Errors.notFound('Compte')
  return c
}

function ecrire(genre: Genre, id: string, data: Partial<Omit<Compte, 'id' | 'email' | 'passwordHash'>>) {
  return genre === 'user' ? prisma.user.update({ where: { id }, data }) : prisma.admin.update({ where: { id }, data })
}

export const codeRequis = () => new AppError('CODE_REQUIS', 'Code de vérification requis', 401)
const codeInvalide = () => new AppError('CODE_INVALIDE', 'Code incorrect. Vérifiez l’heure de votre téléphone, ou utilisez un code de secours.', 401)

/**
 * Vérifie un code (appli ou secours) et le consomme. Renvoie false s'il est faux.
 */
async function consommer(genre: Genre, c: Compte, saisi: string, garder = false) {
  if (!c.totpSecret) return false
  const pas = totp.verifier(totp.dechiffrer(c.totpSecret, graine()), saisi, c.totpDernier)
  if (pas !== null) {
    if (!garder) await ecrire(genre, c.id, { totpDernier: pas })
    return true
  }
  const e = totp.empreinteSecours(saisi)
  if (c.codesSecours.includes(e)) {
    if (!garder) await ecrire(genre, c.id, { codesSecours: c.codesSecours.filter((x) => x !== e) })
    return true
  }
  return false
}

/** À la connexion, après le mot de passe : exige le code si la double authentification est active. */
export async function verifierConnexion(genre: Genre, c: Compte, code?: string | null, garder = false) {
  if (!c.totpActif) return
  if (!code?.trim()) throw codeRequis()
  if (!(await consommer(genre, c, code, garder))) throw codeInvalide()
}

/** Pour les routes de connexion : relit le compte puis vérifie. */
export async function verifierConnexionParId(genre: Genre, id: string, code?: string | null) {
  await verifierConnexion(genre, await lire(genre, id), code)
}

export async function etat(genre: Genre, id: string) {
  const c = await lire(genre, id)
  return { actif: c.totpActif, codesRestants: c.totpActif ? c.codesSecours.length : 0 }
}

/** Nouveau secret à scanner (pas encore actif tant qu'un premier code n'est pas validé). */
export async function preparer(genre: Genre, id: string) {
  const c = await lire(genre, id)
  if (c.totpActif) throw Errors.badRequest('La double authentification est déjà active')
  const secret = totp.nouveauSecret()
  await ecrire(genre, id, { totpSecret: totp.chiffrer(secret, graine()), totpDernier: null })
  return { secret, adresse: totp.adresseOtp(secret, c.email) }
}

/** Active avec un premier code de l'appli. Renvoie les codes de secours (montrés une seule fois). */
export async function activer(genre: Genre, id: string, code: string) {
  const c = await lire(genre, id)
  if (c.totpActif) throw Errors.badRequest('La double authentification est déjà active')
  if (!c.totpSecret) throw Errors.badRequest('Scannez d’abord le QR code')
  const pas = totp.verifier(totp.dechiffrer(c.totpSecret, graine()), code, null)
  if (pas === null) throw codeInvalide()
  const codes = totp.codesDeSecours()
  await ecrire(genre, id, { totpActif: true, totpDernier: pas, codesSecours: codes.map(totp.empreinteSecours) })
  return { codes }
}

/** Désactive : mot de passe et code demandés. */
export async function desactiver(genre: Genre, id: string, motDePasse: string, code: string) {
  const c = await lire(genre, id)
  if (!c.totpActif) return { actif: false }
  if (!(await comparePassword(motDePasse, c.passwordHash))) throw Errors.badRequest('Mot de passe incorrect')
  if (!(await consommer(genre, c, code))) throw codeInvalide()
  await ecrire(genre, id, { totpActif: false, totpSecret: null, totpDernier: null, codesSecours: [] })
  return { actif: false }
}

/** Nouveaux codes de secours (les anciens ne marchent plus). */
export async function nouveauxCodes(genre: Genre, id: string, code: string) {
  const c = await lire(genre, id)
  if (!c.totpActif) throw Errors.badRequest('La double authentification n’est pas active')
  if (!(await consommer(genre, c, code))) throw codeInvalide()
  const codes = totp.codesDeSecours()
  await ecrire(genre, id, { codesSecours: codes.map(totp.empreinteSecours) })
  return { codes }
}

/** Pour le dev : retirer la double authentification d'un client qui a perdu son téléphone et ses codes. */
export async function reinitialiserClient(userId: string) {
  await lire('user', userId)
  await ecrire('user', userId, { totpActif: false, totpSecret: null, totpDernier: null, codesSecours: [] })
}
