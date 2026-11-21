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
import os from 'os'
import { unzipSync } from 'fflate'
import { config } from '../config'
import { Errors } from '../utils/errors'
import * as flags from './flags.service'
import { brancherFormulaires } from './formulaires.html'
import * as modeDev from './mode-dev.service'
import * as blocs from './blocs.service'
import * as pagesDev from './pages.service'
import * as outils from './outils.service'

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
export const listerPagesPubliees = (siteId: string) => lister(dossiers(siteId).publie, (f) => f.endsWith('.html'))

/** Adresse où un formulaire du site envoie ses messages (API de Bifrost). */
export const adresseFormulaire = (siteId: string, nom: string) => `${config.appUrl}/api/formulaires/${siteId}/${encodeURIComponent(nom)}`

/** Branche les formulaires (data-bf-formulaire) de toutes les pages d'un dossier sur Bifrost. */
async function brancherDossier(siteId: string, dossier: string) {
  for (const page of await lister(dossier, (f) => f.endsWith('.html'))) {
    const fichier = path.join(dossier, page)
    const html = brancherFormulaires(await fs.readFile(fichier, 'utf-8'), (nom) => adresseFormulaire(siteId, nom))
    if (html !== null) await fs.writeFile(fichier, html, 'utf-8')
  }
}

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

/** Mode dev : opération sur n'importe quel élément d'une page du brouillon. */
export async function operationDev(siteId: string, page: string, cible: modeDev.Cible, o: modeDev.OperationDev) {
  if (!page.endsWith('.html')) throw Errors.badRequest('Page invalide')
  const r = modeDev.operation(await lire(siteId, page), cible, o)
  await ecrire(siteId, page, r.html)
  return { chemin: r.chemin }
}

/** Mode dev : ajoute une section toute faite (bloc) dans une page, avec des clés libres dans le site. */
export async function insererBloc(siteId: string, page: string, cible: modeDev.Cible | null, position: modeDev.Position, blocId: string) {
  if (!page.endsWith('.html')) throw Errors.badRequest('Page invalide')
  const pris = new Set<string>()
  for (const p of await listerPages(siteId)) for (const x of modeDev.prefixes(await lire(siteId, p))) pris.add(x)
  const bloc = modeDev.renommerBloc(await blocs.lire(blocId), pris)
  const r = modeDev.inserer(await lire(siteId, page), page, cible, bloc, position)
  let html = r.html
  // feuille des blocs et image d'attente : remises à jour à chaque ajout
  const d = dossiers(siteId).brouillon
  for (const [cible, source] of Object.entries(blocs.fichiersDuBloc(bloc))) {
    await fs.mkdir(path.dirname(path.join(d, cible)), { recursive: true })
    await fs.copyFile(source, path.join(d, cible))
  }
  if (bloc.includes('class="bfb')) html = modeDev.lierFeuilleBlocs(html, page) // ne touche qu'au <head> : le chemin dans <body> reste bon
  html = brancherFormulaires(html, (nom) => adresseFormulaire(siteId, nom)) ?? html
  await ecrire(siteId, page, html)
  return { chemin: r.chemin }
}

/** Mode dev : variables CSS du site (:root de ses feuilles) et variables des sections Bifrost. */
/** Pages HTML et feuilles CSS du brouillon, en mémoire, pour les opérations de outils.service. */
async function textesDuBrouillon(siteId: string, filtre: (f: string) => boolean = (f) => /\.(html|css)$/.test(f)): Promise<outils.Fichiers> {
  const d = dossiers(siteId).brouillon
  const res: outils.Fichiers = {}
  for (const f of await lister(d, filtre)) res[f] = await fs.readFile(path.join(d, f), 'utf-8')
  return res
}
async function appliquer(siteId: string, c: outils.Changements) {
  const d = dossiers(siteId).brouillon
  for (const [f, texte] of Object.entries(c.ecrits)) {
    const cible = cheminSur(d, f)
    await fs.mkdir(path.dirname(cible), { recursive: true })
    await fs.writeFile(cible, texte, 'utf-8')
  }
  for (const f of c.supprimes) await fs.rm(cheminSur(d, f), { force: true })
}

/** Mode dev : variables CSS du site (:root) et des sections Bifrost. */
export async function lireTheme(siteId: string) {
  return outils.lireTheme(await textesDuBrouillon(siteId, (f) => f.endsWith('.css')))
}

/** Mode dev : écrit des variables du thème. Les --bf-… vont dans assets/bf-theme.css, lié à toutes les pages. */
export async function ecrireTheme(siteId: string, modifs: { fichier: string; nom: string; valeur: string }[]) {
  await appliquer(siteId, outils.ecrireTheme(await textesDuBrouillon(siteId), modifs))
  return lireTheme(siteId)
}

/** Mode dev : enregistre un élément d'une page comme bloc réutilisable sur tous les sites. */
export async function enregistrerBloc(siteId: string, page: string, cible: modeDev.Cible, nom: string, description?: string) {
  return blocs.enregistrer(nom, modeDev.extraire(await lire(siteId, page), page, cible), description)
}

// ---------- pages (mode dev) ----------

/** Nouvelle page : copie l'en-tête, le menu et le pied de page d'une page du site, contenu vide. Ajoutée au menu si demandé. */
export async function creerPage(siteId: string, o: { chemin?: string; titre: string; depuis?: string; menu: boolean }) {
  const r = await outils.creerPage(await textesDuBrouillon(siteId, (f) => f.endsWith('.html')), o)
  await appliquer(siteId, r)
  return { page: r.page, menus: r.menus }
}

/** Renomme une page : le fichier change de nom et tous les liens du site suivent. */
export async function renommerPage(siteId: string, ancien: string, nouveau: string) {
  const r = outils.renommerPage(await textesDuBrouillon(siteId, (f) => f.endsWith('.html')), ancien, nouveau)
  await appliquer(siteId, r)
  return { page: r.page, liens: r.liens }
}

/** Supprime une page du brouillon et la retire du menu. Les autres liens vers elle sont comptés pour prévenir le dev. */
export async function supprimerPage(siteId: string, page: string) {
  const r = outils.supprimerPage(await textesDuBrouillon(siteId, (f) => f.endsWith('.html')), page)
  await appliquer(siteId, r)
  return { liensRestants: r.liensRestants }
}

// ---------- sites modèles (espace dev) ----------

/** Modèles fournis avec Bifrost : packages/server/modeles/<id>/ avec un modele.json { nom, description, icone }. */
export const dossierModeles = path.resolve(path.dirname(blocs.dossierBlocsFournis), 'modeles')

export interface ModeleSite { id: string; nom: string; description: string; icone: string }

export async function listerModeles(): Promise<ModeleSite[]> {
  if (!existsSync(dossierModeles)) return []
  const res: ModeleSite[] = []
  for (const e of await fs.readdir(dossierModeles, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    let meta = { nom: e.name, description: '', icone: '🧩', ordre: 99 }
    try { meta = { ...meta, ...JSON.parse(await fs.readFile(path.join(dossierModeles, e.name, 'modele.json'), 'utf-8')) } } catch { /* sans fiche : valeurs par défaut */ }
    res.push({ id: e.name, nom: meta.nom, description: meta.description, icone: meta.icone, ordre: meta.ordre } as ModeleSite & { ordre: number })
  }
  return (res as (ModeleSite & { ordre: number })[]).sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, 'fr')).map(({ ordre: _o, ...m }) => m)
}

/**
 * Met en place un site depuis un modèle fourni (« modele:<id> ») ou depuis un autre site (sa version en ligne).
 * vider : chaque liste garde un seul élément et les pages de collection (actualités…) des éléments retirés disparaissent.
 */
export async function importerModele(siteId: string, source: string, vider: boolean) {
  let dossier: string
  if (source.startsWith('modele:')) {
    const id = source.slice(7)
    if (!/^[a-z0-9-]{1,60}$/.test(id) || !existsSync(path.join(dossierModeles, id))) throw Errors.badRequest('Modèle inconnu')
    dossier = path.join(dossierModeles, id)
  } else {
    dossier = dossiers(source).publie
    if (!existsSync(dossier)) throw Errors.badRequest('Site modèle introuvable')
  }
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'bifrost-modele-'))
  try {
    await fs.cp(dossier, temp, { recursive: true, filter: (s) => path.basename(s) !== 'modele.json' })
    if (vider) {
      const pages = await lister(temp, (f) => f.endsWith('.html'))
      const aRetirer = new Set<string>()
      for (const p of pages) {
        const r = pagesDev.viderListes(await fs.readFile(path.join(temp, p), 'utf-8'), p)
        await fs.writeFile(path.join(temp, p), r.html, 'utf-8')
        r.pagesRetirees.forEach((x) => aRetirer.add(x))
      }
      // une page encore liée ailleurs (premier élément d'une autre liste…) reste
      const encoreLiees = new Set<string>()
      for (const p of pages) {
        const h = await fs.readFile(path.join(temp, p), 'utf-8')
        if (aRetirer.has(p) || h.includes('data-bf-page=')) continue // liens « précédente / suivante » entre actualités : sans effet
        pagesDev.liensDe(h, p).forEach((x) => encoreLiees.add(x))
      }
      for (const p of aRetirer) {
        if (encoreLiees.has(p)) continue
        const f = cheminSur(temp, p)
        if (existsSync(f) && (await fs.readFile(f, 'utf-8')).includes('data-bf-page=')) await fs.rm(f)
      }
    }
    return await importerDepuis(siteId, temp)
  } finally {
    await fs.rm(temp, { recursive: true, force: true })
  }
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

export interface Changement { cle: string; texte: string }

const libelle = (cle: string) => { const t = cle.replace(/[-_.]+/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1) }
const court = (v: string) => { const t = v.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > 40 ? t.slice(0, 39) + '…' : t }
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/**
 * Les modifications vues par le client : un champ partagé (menu, pied de page) recopié
 * dans 56 pages compte pour une seule modification.
 */
export async function changements(siteId: string, diff?: { ajoutes: string[]; modifies: string[]; supprimes: string[] }): Promise<Changement[]> {
  const d = dossiers(siteId)
  diff ??= await differences(siteId)
  const html = (f: string) => f.endsWith('.html')
  const analyse = async (dossier: string, f: string) => flags.analyser(await fs.readFile(path.join(dossier, f), 'utf-8'), f)
  const champs = new Map<string, { m: flags.ChampModifie; pages: number }>()
  const listes = new Map<string, flags.ListeModifiee>()
  const res: Changement[] = []
  for (const f of diff.modifies.filter(html)) {
    let c: ReturnType<typeof flags.comparer>
    try { c = flags.comparer(await analyse(d.publie, f), await analyse(d.brouillon, f)) } catch { continue }
    for (const m of c.champs) {
      const e = champs.get(m.cle)
      if (e) e.pages++
      else champs.set(m.cle, { m, pages: 1 })
    }
    for (const l of c.listes) {
      const e = listes.get(l.nom)
      if (!e || (!e.complete && l.complete)) listes.set(l.nom, l)
    }
  }
  for (const [f, ajout] of [...diff.ajoutes.map((f) => [f, true] as const), ...diff.supprimes.map((f) => [f, false] as const)]) {
    if (!html(f)) continue
    // une page d'actualité (modèle de collection) est déjà comptée avec sa liste
    try { if ((await analyse(ajout ? d.brouillon : d.publie, f)).modele) continue } catch { /* page illisible : on la compte */ }
    res.push({ cle: `page:${f}`, texte: `${ajout ? 'Nouvelle page' : 'Page supprimée'} : ${f}` })
  }
  for (const { m, pages } of champs.values()) {
    const ou = pages > 1 ? ` (sur ${pages} pages)` : ''
    const quoi = m.type === 'image' ? 'image changée' : m.type === 'riche' ? 'texte modifié' : `« ${court(m.avant)} » → « ${court(m.apres)} »`
    res.unshift({ cle: `champ:${m.cle}`, texte: `${libelle(m.cle)} : ${quoi}${ou}` })
  }
  for (const l of listes.values()) {
    const ecart = l.apres - l.avant
    const quoi = ecart > 0 ? `${pluriel(ecart, 'élément')} ajouté${ecart > 1 ? 's' : ''}` : ecart < 0 ? `${pluriel(-ecart, 'élément')} retiré${ecart < -1 ? 's' : ''}` : 'modifiée'
    res.push({ cle: `liste:${l.nom}`, texte: `${libelle(l.nom)} : ${quoi}` })
  }
  const total = diff.ajoutes.length + diff.modifies.length + diff.supprimes.length
  if (!res.length && total) res.push({ cle: 'fichiers', texte: `${pluriel(total, 'fichier')} modifié${total > 1 ? 's' : ''}` })
  return res
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
  return importerDepuis(siteId, source)
}

const IGNORES = /(^|[\\/])(\.git|node_modules|ancien-site|outils|__MACOSX)([\\/]|$)/

async function importerDepuis(siteId: string, source: string) {
  const d = dossiers(siteId)
  await fs.rm(d.racine, { recursive: true, force: true })
  await fs.cp(source, d.brouillon, { recursive: true, filter: (s) => !IGNORES.test(path.relative(source, s)) })
  await brancherDossier(siteId, d.brouillon)
  await fs.cp(d.brouillon, d.publie, { recursive: true })
  return { pages: await listerPages(siteId) }
}

/**
 * Importe un site envoyé depuis le navigateur, sous forme de ZIP (un dossier glissé est zippé par le navigateur).
 * Si tout est rangé dans un seul dossier racine (ZIP d'un dossier), on prend son contenu.
 */
export async function importerZip(siteId: string, zip: Uint8Array) {
  let entrees: Record<string, Uint8Array>
  try {
    entrees = unzipSync(zip)
  } catch {
    throw new Error('Ce fichier n’est pas un ZIP lisible')
  }
  const noms = Object.keys(entrees).map((n) => n.replace(/\\/g, '/')).filter((n) => !n.endsWith('/') && !IGNORES.test(n) && !/(^|\/)(\.DS_Store|Thumbs\.db)$/.test(n))
  if (!noms.some((n) => /\.html?$/i.test(n))) throw new Error('Aucune page HTML dans cet envoi')
  const premier = (noms[0] ?? "").split("/")[0]
  const prefixe = noms.every((n) => n.startsWith(premier + '/')) ? premier + '/' : ''
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'bifrost-envoi-'))
  try {
    for (const brut of Object.keys(entrees)) {
      const nom = brut.replace(/\\/g, '/')
      if (!noms.includes(nom)) continue
      const relatif = nom.slice(prefixe.length)
      const cible = path.resolve(temp, relatif)
      if (!relatif || path.relative(temp, cible).startsWith('..') || path.isAbsolute(path.relative(temp, cible))) continue
      await fs.mkdir(path.dirname(cible), { recursive: true })
      await fs.writeFile(cible, entrees[brut] as Uint8Array)
    }
    return await importerDepuis(siteId, temp)
  } finally {
    await fs.rm(temp, { recursive: true, force: true })
  }
}

// ---------- pause, export, corbeille (espace dev) ----------

/**
 * Page affichée à la place du site quand il est en pause. Le fichier sert aussi de marqueur :
 * Bifrost (/sites/…) et nginx (domaine du client) regardent s'il existe.
 */
export const fichierPause = (siteId: string) => path.join(dossiers(siteId).racine, 'pause.html')

export function pageDePause(nom: string) {
  const e = nom.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${e}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#f4f4f5;color:#18181b;padding:16px;box-sizing:border-box;text-align:center}main{max-width:420px}h1{font-size:24px;margin:0 0 8px}p{margin:0;color:#52525b}@media(prefers-color-scheme:dark){body{background:#0b0c12;color:#e4e4e7}p{color:#a1a1aa}}</style>
</head><body><main><h1>${e}</h1><p>Ce site est momentanément indisponible. Merci de revenir un peu plus tard.</p></main></body></html>`
}

export async function mettreEnPause(siteId: string, nom: string, pause: boolean) {
  const f = fichierPause(siteId)
  if (pause) {
    await fs.mkdir(path.dirname(f), { recursive: true })
    await fs.writeFile(f, pageDePause(nom))
  } else {
    await fs.rm(f, { force: true })
  }
}

/** Le site en ZIP (version en ligne ou brouillon), pour le déplacer chez un autre hébergeur. */
export async function exporterZip(siteId: string, version: 'publie' | 'brouillon' = 'publie') {
  const { zipSync } = await import('fflate')
  const base = dossiers(siteId)[version]
  const fichiers = await lister(base)
  if (!fichiers.length) throw Errors.notFound('Fichiers du site')
  const contenu: Record<string, Uint8Array> = {}
  for (const f of fichiers) contenu[f] = new Uint8Array(await fs.readFile(path.join(base, f)))
  return Buffer.from(zipSync(contenu, { level: 6 }))
}

/** Corbeille : les sites supprimés y restent 30 jours (fichiers + données), puis sont effacés. */
export const JOURS_CORBEILLE = 30
// Dans le dossier des sites (même volume, donc déplacement instantané et compris dans la sauvegarde)
export const dossierCorbeille = () => path.join(config.sitesDir, '_corbeille')

const entreeCorbeille = (siteId: string) => {
  dossiers(siteId) // vérifie l'identifiant
  return path.join(dossierCorbeille(), siteId)
}

/** Range les fichiers du site et ses données (JSON) dans la corbeille. */
export async function mettreALaCorbeille(siteId: string, donnees: unknown) {
  const d = dossiers(siteId)
  const cible = entreeCorbeille(siteId)
  await fs.rm(cible, { recursive: true, force: true })
  await fs.mkdir(cible, { recursive: true })
  if (existsSync(d.racine)) await fs.rename(d.racine, path.join(cible, 'fichiers'))
  await fs.writeFile(path.join(cible, 'donnees.json'), JSON.stringify(donnees))
}

export async function lireCorbeille(siteId: string) {
  return JSON.parse(await fs.readFile(path.join(entreeCorbeille(siteId), 'donnees.json'), 'utf-8'))
}

export async function listerCorbeille(): Promise<string[]> {
  if (!existsSync(dossierCorbeille())) return []
  return (await fs.readdir(dossierCorbeille(), { withFileTypes: true })).filter((e) => e.isDirectory() && /^[a-zA-Z0-9-]+$/.test(e.name)).map((e) => e.name)
}

/** Remet les fichiers en place (les données sont recréées par l'appelant). */
export async function sortirDeLaCorbeille(siteId: string) {
  const d = dossiers(siteId)
  const source = path.join(entreeCorbeille(siteId), 'fichiers')
  if (existsSync(d.racine)) throw Errors.badRequest('Un site occupe déjà cet emplacement')
  if (existsSync(source)) {
    await fs.mkdir(path.dirname(d.racine), { recursive: true })
    await fs.rename(source, d.racine)
  }
  await fs.rm(entreeCorbeille(siteId), { recursive: true, force: true })
}

export const viderEntreeCorbeille = (siteId: string) => fs.rm(entreeCorbeille(siteId), { recursive: true, force: true })
