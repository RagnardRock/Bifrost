/**
 * Outils du dev (Rune) : jetons d'accès, fichiers d'un site, envoi d'une nouvelle version.
 *
 * Rune envoie d'abord un essai (toutes les pages HTML + l'empreinte des autres fichiers) :
 * Bifrost répond ce qui changerait en ligne et les fichiers qui lui manquent. Ensuite
 * l'envoi réel (les pages + les fichiers manquants) devient une publication du dev,
 * avec son historique : on peut revenir en arrière depuis l'éditeur ou l'espace dev.
 */
import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { nanoid } from 'nanoid'
import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import * as fichiers from './site-fichiers.service'
import { brancherFormulaires } from './formulaires.html'

// ---------- jetons ----------

export const PREFIXE_JETON = 'bfd_'
export const empreinteJeton = (jeton: string) => crypto.createHash('sha256').update(jeton).digest('hex')

export async function creerJeton(adminId: string, appareil: string) {
  const jeton = `${PREFIXE_JETON}${nanoid(40)}`
  const j = await prisma.jetonDev.create({ data: { adminId, appareil: appareil.slice(0, 80) || 'Rune', hash: empreinteJeton(jeton) } })
  return { jeton, id: j.id }
}

/** Le compte dev d'un jeton (et la date de dernier usage, mise à jour au plus une fois par minute). */
export async function verifierJeton(jeton: string) {
  const j = await prisma.jetonDev.findUnique({ where: { hash: empreinteJeton(jeton) } })
  if (!j) return null
  if (!j.dernierUsage || Date.now() - j.dernierUsage.getTime() > 60_000) {
    prisma.jetonDev.update({ where: { id: j.id }, data: { dernierUsage: new Date() } }).catch(() => {})
  }
  return j
}

// ---------- fichiers ----------

export type Version = 'publie' | 'brouillon'

const sha1 = (b: Buffer | Uint8Array) => crypto.createHash('sha1').update(b).digest('hex')

async function lister(dossier: string): Promise<string[]> {
  const res: string[] = []
  async function parcourir(d: string) {
    if (!existsSync(d)) return
    for (const e of await fs.readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) await parcourir(p)
      else res.push(path.relative(dossier, p).split(path.sep).join('/'))
    }
  }
  await parcourir(dossier)
  return res.sort()
}

/** Chaque fichier d'une version du site, avec son empreinte SHA-1 et sa taille. */
export async function manifeste(siteId: string, version: Version) {
  const dossier = fichiers.dossiers(siteId)[version]
  const res: { chemin: string; sha1: string; taille: number }[] = []
  for (const chemin of await lister(dossier)) {
    const contenu = await fs.readFile(path.join(dossier, chemin))
    res.push({ chemin, sha1: sha1(contenu), taille: contenu.length })
  }
  return res
}

export async function lireFichier(siteId: string, version: Version, chemin: string) {
  const f = fichiers.cheminSur(fichiers.dossiers(siteId)[version], chemin)
  if (!existsSync(f)) throw Errors.notFound('Fichier')
  return fs.readFile(f)
}

// ---------- envoi ----------

export interface DemandeEnvoi {
  /** Empreinte SHA-1 de chaque fichier du dossier local (le site complet). */
  manifeste: Record<string, string>
  /** Contenu (base64) : toutes les pages HTML, et les autres fichiers que Bifrost a demandés. */
  fichiers: Record<string, string>
  /** Supprimer en ligne les fichiers absents du dossier local (sinon ils sont gardés). */
  supprimer?: boolean
}

const estHtml = (f: string) => /\.html?$/i.test(f)
const IGNORES = /(^|\/)(\.git|node_modules|__MACOSX)(\/|$)|(^|\/)(\.DS_Store|Thumbs\.db|\.bifrost\.json)$/

function cheminValide(c: string) {
  const p = path.posix.normalize(c.replace(/\\/g, '/')).replace(/^\/+/, '')
  if (!p || p === '.' || p.startsWith('..') || path.posix.isAbsolute(p) || IGNORES.test(p)) return null
  return p
}

/**
 * Prépare la future version en ligne dans un dossier temporaire : la version en ligne, moins les fichiers
 * absents du dossier local (si demandé), plus les fichiers reçus (pages HTML branchées sur les formulaires).
 */
async function preparer(siteId: string, d: DemandeEnvoi) {
  const local = new Map<string, string>()
  for (const [c, h] of Object.entries(d.manifeste || {})) {
    const p = cheminValide(c)
    if (p && /^[0-9a-f]{40}$/.test(h)) local.set(p, h)
  }
  if (![...local.keys()].some(estHtml)) throw Errors.badRequest('Aucune page HTML dans le dossier envoyé')
  const recus = new Map<string, Buffer>()
  for (const [c, b64] of Object.entries(d.fichiers || {})) {
    const p = cheminValide(c)
    if (p && local.has(p)) recus.set(p, Buffer.from(b64, 'base64'))
  }
  const dos = fichiers.dossiers(siteId)
  if (!existsSync(dos.publie)) throw Errors.badRequest('Ce site n’a pas encore été importé dans Bifrost')
  const enLigne = new Map((await manifeste(siteId, 'publie')).map((f) => [f.chemin, f.sha1]))

  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'bifrost-dev-'))
  const manquants: string[] = []
  await fs.cp(dos.publie, temp, { recursive: true })
  for (const [chemin, h] of local) {
    const cible = fichiers.cheminSur(temp, chemin)
    const contenu = recus.get(chemin)
    if (estHtml(chemin)) {
      if (!contenu) { manquants.push(chemin); continue }
      const html = contenu.toString('utf-8')
      await fs.mkdir(path.dirname(cible), { recursive: true })
      await fs.writeFile(cible, brancherFormulaires(html, (nom) => fichiers.adresseFormulaire(siteId, nom)) ?? html, 'utf-8')
    } else if (contenu) {
      if (sha1(contenu) !== h) throw Errors.badRequest(`Fichier abîmé pendant l’envoi : ${chemin}`)
      await fs.mkdir(path.dirname(cible), { recursive: true })
      await fs.writeFile(cible, contenu)
    } else if (enLigne.get(chemin) !== h) {
      manquants.push(chemin)
    }
  }
  const absents = [...enLigne.keys()].filter((f) => !local.has(f))
  if (d.supprimer) for (const f of absents) await fs.rm(fichiers.cheminSur(temp, f), { force: true })
  return { temp, manquants, absents }
}

/** Fichiers ajoutés, modifiés ou supprimés entre la version en ligne et le dossier préparé. */
async function comparer(siteId: string, temp: string) {
  const enLigne = new Map((await manifeste(siteId, 'publie')).map((f) => [f.chemin, f.sha1]))
  const ajoutes: string[] = [], modifies: string[] = []
  for (const f of await lister(temp)) {
    const h = sha1(await fs.readFile(path.join(temp, f)))
    if (!enLigne.has(f)) ajoutes.push(f)
    else if (enLigne.get(f) !== h) modifies.push(f)
    enLigne.delete(f)
  }
  return { ajoutes, modifies, supprimes: [...enLigne.keys()] }
}

/** Ce qu'un envoi changerait, sans rien toucher. */
export async function essaiEnvoi(siteId: string, d: DemandeEnvoi, depuis?: Date) {
  const { temp, manquants, absents } = await preparer(siteId, d)
  try {
    const diff = await comparer(siteId, temp)
    const clientEnAttente = await fichiers.changements(siteId).catch(() => [])
    const publicationsDepuis = depuis ? await publicationsClient(siteId, depuis) : []
    return { ...diff, manquants, absents, clientEnAttente, publicationsDepuis }
  } finally {
    await fs.rm(temp, { recursive: true, force: true })
  }
}

/** Publications faites par l'équipe du client (pas par un dev) depuis une date. */
async function publicationsClient(siteId: string, depuis: Date) {
  const pubs = await prisma.publication.findMany({ where: { siteId, annulee: false, createdAt: { gt: depuis } }, orderBy: { createdAt: 'desc' } })
  const admins = new Set((await prisma.admin.findMany({ select: { id: true } })).map((a) => a.id))
  return pubs.filter((p) => !p.auteur || !admins.has(p.auteur)).map((p) => ({ id: p.id, date: p.createdAt, changements: p.changements }))
}

/**
 * Envoie la nouvelle version : elle devient le brouillon puis est publiée (avec historique).
 * Refusé si l'équipe du client a des modifications non publiées, sauf si ecraserBrouillon.
 */
export async function envoyer(siteId: string, adminId: string, d: DemandeEnvoi & { ecraserBrouillon?: boolean }) {
  const enAttente = await fichiers.changements(siteId).catch(() => [])
  if (enAttente.length && !d.ecraserBrouillon) {
    throw Errors.conflict('L’équipe du site a des modifications non publiées : rapatriez-les d’abord, ou confirmez qu’elles seront perdues')
  }
  const { temp, manquants } = await preparer(siteId, d)
  try {
    if (manquants.length) throw Errors.badRequest(`Fichiers manquants dans l’envoi : ${manquants.slice(0, 5).join(', ')}`)
    const dos = fichiers.dossiers(siteId)
    const pub = await prisma.publication.create({ data: { siteId, auteur: adminId, ajoutes: [], modifies: [], supprimes: [] } })
    await fs.rm(dos.brouillon, { recursive: true, force: true })
    await fs.cp(temp, dos.brouillon, { recursive: true })
    const changements = await fichiers.changements(siteId)
    const diff = await fichiers.publier(siteId, pub.id)
    if (!diff.ajoutes.length && !diff.modifies.length && !diff.supprimes.length) {
      await prisma.publication.delete({ where: { id: pub.id } })
      return { publication: null }
    }
    return { publication: await prisma.publication.update({ where: { id: pub.id }, data: { ...diff, changements: changements as never } }) }
  } finally {
    await fs.rm(temp, { recursive: true, force: true })
  }
}
