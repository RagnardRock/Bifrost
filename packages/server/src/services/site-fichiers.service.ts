/**
 * Fichiers d'un site statique géré par Bifrost.
 *
 * <SITES_DIR>/<siteId>/
 *   brouillon/   ce que le client modifie (servi dans l'éditeur)
 *   publie/      la version en ligne (servie au public par le serveur web)
 *   historique/<publicationId>/  les fichiers de publie/ remplacés ou supprimés par une publication
 */
import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'
import { nanoid } from 'nanoid'
import { config } from '../config'
import { Errors } from '../utils/errors'
import * as flags from './flags.service'

export function dossiers(siteId: string) {
  if (!/^[a-zA-Z0-9-]+$/.test(siteId)) throw Errors.badRequest('Site invalide')
  const racine = path.join(config.sitesDir, siteId)
  return {
    racine,
    brouillon: path.join(racine, 'brouillon'),
    publie: path.join(racine, 'publie'),
    historique: path.join(racine, 'historique'),
  }
}

/** Chemin de page sûr (pas de sortie du dossier du site). */
export function cheminSur(base: string, page: string): string {
  const p = path.posix.normalize(page.replace(/\\/g, '/')).replace(/^\/+/, '')
  if (p.startsWith('..') || path.isAbsolute(p)) throw Errors.badRequest('Chemin invalide')
  return path.join(base, p)
}

async function lister(dossier: string, filtre?: (f: string) => boolean): Promise<string[]> {
  const res: string[] = []
  async function parcourir(d: string) {
    if (!existsSync(d)) return
    for (const e of await fs.readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) await parcourir(p)
      else {
        const rel = path.relative(dossier, p).split(path.sep).join('/')
        if (!filtre || filtre(rel)) res.push(rel)
      }
    }
  }
  await parcourir(dossier)
  return res.sort()
}

export const listerPages = (siteId: string) => lister(dossiers(siteId).brouillon, (f) => f.endsWith('.html'))

async function lire(siteId: string, page: string) {
  return fs.readFile(cheminSur(dossiers(siteId).brouillon, page), 'utf-8')
}
async function ecrire(siteId: string, page: string, html: string) {
  await fs.writeFile(cheminSur(dossiers(siteId).brouillon, page), html, 'utf-8')
}

export async function analyserPage(siteId: string, page: string) {
  return flags.analyser(await lire(siteId, page), page)
}

/** Noms des collections : les listes qui ont une page modèle (data-bf-page). */
async function collections(siteId: string): Promise<Map<string, string>> {
  const res = new Map<string, string>()
  for (const p of await listerPages(siteId)) {
    const m = /data-bf-page="([^"]+)"/.exec(await lire(siteId, p))
    if (m?.[1] && !res.has(m[1])) res.set(m[1], p)
  }
  return res
}

/** Modifie un champ hors liste sur toutes les pages où il apparaît (coordonnées, pied de page…). */
export async function modifierChamp(siteId: string, cle: string, valeur: string) {
  const pages: string[] = []
  for (const p of await listerPages(siteId)) {
    const avant = await lire(siteId, p)
    if (!avant.includes(`data-bf="${cle}"`)) continue
    const { html, touches } = flags.modifierChamp(avant, p, cle, valeur)
    if (touches) { await ecrire(siteId, p, html); pages.push(p) }
  }
  return { pages }
}

/** Pages qui contiennent la version complète (non limitée) d'une collection. */
async function pagesCompletes(siteId: string, nom: string) {
  const res: string[] = []
  for (const p of await listerPages(siteId)) {
    const h = await lire(siteId, p)
    if (!h.includes(`data-bf-liste="${nom}"`)) continue
    if (flags.analyser(h, p).listes.some((l) => l.nom === nom && l.limite === null)) res.push(p)
  }
  return res
}

async function resynchroniser(siteId: string, nom: string, source: string) {
  const complets = flags.elementsListe(await lire(siteId, source), source, nom)
  for (const p of await listerPages(siteId)) {
    const h = await lire(siteId, p)
    if (!h.includes(`data-bf-liste="${nom}"`) || !h.includes('data-bf-limite')) continue
    await ecrire(siteId, p, flags.synchroniserListeLimitee(h, p, nom, complets))
  }
}

/**
 * Opération sur une liste. Pour une collection (ex. actualités), l'opération se fait sur la liste
 * complète puis les listes limitées (ex. 3 dernières sur l'accueil) sont recalculées.
 */
export async function operationListe(siteId: string, page: string, nom: string, o: flags.OperationListe) {
  const cols = await collections(siteId)
  if (!cols.has(nom)) {
    const { html, touches } = flags.operationListe(await lire(siteId, page), page, nom, o)
    if (!touches) throw Errors.notFound('Élément')
    await ecrire(siteId, page, html)
    return { pages: [page] }
  }
  // l'index reçu est celui de la page affichée ; il est le même dans la liste complète (même ordre)
  const completes = await pagesCompletes(siteId, nom)
  let lienSupprime: string | null = null
  for (const p of completes) {
    const h = await lire(siteId, p)
    if (o.op === 'supprimer' && !lienSupprime) {
      const el = flags.elementsListe(h, p, nom)[o.index]
      const m = el && /href="([^"#?]+)"/.exec(el)
      if (m?.[1]?.endsWith('.html')) lienSupprime = path.posix.normalize(m[1])
    }
    const { html } = flags.operationListe(h, p, nom, o)
    await ecrire(siteId, p, html)
  }
  if (completes[0]) await resynchroniser(siteId, nom, completes[0])
  if (lienSupprime && lienSupprime !== cols.get(nom)) {
    await fs.rm(cheminSur(dossiers(siteId).brouillon, lienSupprime), { force: true })
  }
  return { pages: completes }
}

/** Crée un élément de collection : sa page (depuis le modèle) et sa carte en tête des listes. */
export async function nouvelElement(siteId: string, nom: string, donnees: { titre: string; date?: string; texte?: string; photos: string[] }) {
  const cols = await collections(siteId)
  const modele = cols.get(nom)
  if (!modele) throw Errors.badRequest(`Pas de page modèle pour « ${nom} »`)
  const dossierModele = path.posix.dirname(modele)
  let base = flags.slugifier(donnees.titre)
  let page = path.posix.join(dossierModele === '.' ? '' : dossierModele, `${base}.html`)
  for (let i = 2; existsSync(cheminSur(dossiers(siteId).brouillon, page)); i++) {
    page = path.posix.join(dossierModele === '.' ? '' : dossierModele, `${base}-${i}.html`)
  }
  const n: flags.NouvelElement = { ...donnees, page }
  await ecrire(siteId, page, flags.pageDepuisModele(await lire(siteId, modele), n))
  const completes = await pagesCompletes(siteId, nom)
  for (const p of completes) {
    const { html } = flags.ajouterEnTete(await lire(siteId, p), p, nom, n)
    await ecrire(siteId, p, html)
  }
  if (completes[0]) await resynchroniser(siteId, nom, completes[0])
  return { page }
}

/** Enregistre une image allégée (WebP, 1600 px max) et renvoie son chemin depuis la racine du site. */
export async function enregistrerImage(siteId: string, contenu: Buffer) {
  const nom = `medias/${new Date().toISOString().slice(0, 10)}-${nanoid(8)}.webp`
  const dest = cheminSur(dossiers(siteId).brouillon, nom)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await sharp(contenu).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 }).toFile(dest)
  return nom
}

// ---------- publication ----------

const empreinte = async (f: string) => crypto.createHash('sha1').update(await fs.readFile(f)).digest('hex')

/** Fichiers ajoutés, modifiés ou supprimés par rapport à la version en ligne. */
export async function differences(siteId: string) {
  const d = dossiers(siteId)
  const b = await lister(d.brouillon)
  const p = new Set(await lister(d.publie))
  const ajoutes: string[] = [], modifies: string[] = []
  for (const f of b) {
    if (!p.has(f)) ajoutes.push(f)
    else if (await empreinte(path.join(d.brouillon, f)) !== await empreinte(path.join(d.publie, f))) modifies.push(f)
    p.delete(f)
  }
  return { ajoutes, modifies, supprimes: [...p] }
}

async function copier(de: string, vers: string) {
  await fs.mkdir(path.dirname(vers), { recursive: true })
  await fs.copyFile(de, vers)
}

/** Publie le brouillon. Les fichiers remplacés sont gardés dans historique/<id>/ pour pouvoir revenir en arrière. */
export async function publier(siteId: string, publicationId: string) {
  const d = dossiers(siteId)
  const diff = await differences(siteId)
  const sauvegarde = path.join(d.historique, publicationId)
  for (const f of [...diff.modifies, ...diff.supprimes]) await copier(path.join(d.publie, f), path.join(sauvegarde, f))
  for (const f of [...diff.ajoutes, ...diff.modifies]) await copier(path.join(d.brouillon, f), path.join(d.publie, f))
  for (const f of diff.supprimes) await fs.rm(path.join(d.publie, f), { force: true })
  return diff
}

/** Annule une publication : remet les fichiers d'avant (en ligne et dans le brouillon). */
export async function annulerPublication(siteId: string, publicationId: string, diff: { ajoutes: string[]; modifies: string[]; supprimes: string[] }) {
  const d = dossiers(siteId)
  const sauvegarde = path.join(d.historique, publicationId)
  for (const f of [...diff.modifies, ...diff.supprimes]) {
    await copier(path.join(sauvegarde, f), path.join(d.publie, f))
    await copier(path.join(sauvegarde, f), path.join(d.brouillon, f))
  }
  for (const f of diff.ajoutes) {
    await fs.rm(path.join(d.publie, f), { force: true })
    await fs.rm(path.join(d.brouillon, f), { force: true })
  }
}

/** Abandonne les modifications non publiées. */
export async function abandonnerBrouillon(siteId: string) {
  const d = dossiers(siteId)
  await fs.rm(d.brouillon, { recursive: true, force: true })
  await fs.cp(d.publie, d.brouillon, { recursive: true })
}

/** Importe un dossier de site (première mise en place). */
/**
 * Dossier à importer. Avec IMPORT_DIR (en ligne), on n'accepte que ses sous-dossiers :
 * « ehpad-saintpaulien » désigne IMPORT_DIR/ehpad-saintpaulien.
 */
function dossierImport(dossier: string) {
  if (!config.importDir) return path.resolve(dossier)
  const chemin = path.resolve(config.importDir, dossier)
  const rel = path.relative(config.importDir, chemin)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error("Le dossier doit être déposé dans le dossier d’import du serveur (indiquez seulement son nom)")
  return chemin
}

export async function importer(siteId: string, dossier: string) {
  const source = dossierImport(dossier)
  const info = await fs.stat(source).catch(() => null)
  if (!info?.isDirectory()) throw new Error(`Dossier introuvable sur le serveur : ${dossier}`)
  const d = dossiers(siteId)
  await fs.rm(d.racine, { recursive: true, force: true })
  const filtre = (s: string) => !/(^|[\\/])(\.git|node_modules|ancien-site|outils)([\\/]|$)/.test(path.relative(source, s))
  await fs.cp(source, d.brouillon, { recursive: true, filter: filtre })
  await fs.cp(d.brouillon, d.publie, { recursive: true })
  return { pages: await listerPages(siteId) }
}
