/**
 * Opérations du mode dev sur un ensemble de fichiers en mémoire (chemin depuis la racine → texte).
 * Elles servent deux fois : sur le brouillon d'un site (site-fichiers.service) et sur le dossier local
 * du dev, que Rune envoie par l'API /api/dev/outils. Un seul moteur pour les deux.
 *
 * Chaque opération renvoie les fichiers à écrire et ceux à supprimer ; l'appelant applique.
 */
import path from 'path'
import fs from 'fs/promises'
import { Errors } from '../utils/errors'
import * as pagesDev from './pages.service'
import * as theme from './theme.service'
import * as modeDev from './mode-dev.service'
import * as blocs from './blocs.service'

export type Fichiers = Record<string, string>
export interface Changements { ecrits: Fichiers; supprimes: string[] }

const pagesDe = (f: Fichiers) => Object.keys(f).filter((p) => p.endsWith('.html')).sort()

/** Fichiers fournis par Bifrost que le contenu demande (feuille des blocs, image d'attente), en texte. */
async function fichiersFournis(html: string): Promise<Fichiers> {
  const res: Fichiers = {}
  for (const [cible, source] of Object.entries(blocs.fichiersDuBloc(html))) res[cible] = await fs.readFile(source, 'utf-8')
  return res
}

export async function creerPage(f: Fichiers, o: { chemin?: string; titre: string; depuis?: string; menu: boolean }) {
  const chemin = pagesDev.verifierChemin(o.chemin || pagesDev.cheminPour(o.titre))
  if (f[chemin] !== undefined) throw Errors.badRequest(`La page ${chemin} existe déjà`)
  const toutes = pagesDe(f)
  const source = o.depuis && toutes.includes(o.depuis) ? o.depuis : (toutes.includes('index.html') ? 'index.html' : toutes[0])
  if (!source) throw Errors.badRequest('Le site n’a aucune page à copier')
  // le contenu de départ est une section Bifrost : sa feuille de style vient avec
  const html = modeDev.lierFeuilleBlocs(pagesDev.nouvellePage(f[source] as string, source, chemin, o.titre), chemin)
  const ecrits: Fichiers = { ...await fichiersFournis(html), [chemin]: html }
  let menus = 0
  if (o.menu) {
    for (const p of [...toutes, chemin]) {
      const h = pagesDev.ajouterAuMenu(ecrits[p] ?? f[p] as string, p, chemin, o.titre)
      if (h !== null) { ecrits[p] = h; menus++ }
    }
  }
  return { page: chemin, menus, ecrits, supprimes: [] as string[] }
}

export function renommerPage(f: Fichiers, ancien: string, nouveauBrut: string) {
  const nouveau = pagesDev.verifierChemin(nouveauBrut)
  if (ancien === nouveau) return { page: nouveau, liens: 0, ecrits: {}, supprimes: [] as string[] }
  if (ancien === 'index.html') throw Errors.badRequest('La page d’accueil (index.html) garde son nom')
  if (f[ancien] === undefined) throw Errors.notFound('Page')
  if (f[nouveau] !== undefined) throw Errors.badRequest(`La page ${nouveau} existe déjà`)
  const ecrits: Fichiers = { [nouveau]: pagesDev.deplacerPage(f[ancien] as string, ancien, nouveau) }
  let liens = 0
  for (const p of [...pagesDe(f).filter((x) => x !== ancien), nouveau]) {
    const r = pagesDev.suivreRenommage(ecrits[p] ?? f[p] as string, p, ancien, nouveau)
    if (r.touches) { ecrits[p] = r.html; liens += r.touches }
  }
  return { page: nouveau, liens, ecrits, supprimes: [ancien] }
}

export function supprimerPage(f: Fichiers, page: string) {
  if (page === 'index.html') throw Errors.badRequest('La page d’accueil ne se supprime pas')
  if (!page.endsWith('.html') || f[page] === undefined) throw Errors.notFound('Page')
  const ecrits: Fichiers = {}
  const liensRestants: string[] = []
  for (const p of pagesDe(f)) {
    if (p === page) continue
    const r = pagesDev.retirerDuMenu(f[p] as string, p, page)
    if (r.retires) ecrits[p] = r.html
    if (r.autres) liensRestants.push(p)
  }
  return { liensRestants, ecrits, supprimes: [page] }
}

// ---------- thème ----------

const feuilleDuSite = (f: string) => f.endsWith('.css') && !/(^|\/)(bifrost-blocs|bf-theme)\.css$/.test(f) && !/(^|\/)medias\//.test(f)

export function lireTheme(f: Fichiers) {
  const site: { fichier: string; nom: string; valeur: string }[] = []
  for (const fichier of Object.keys(f).filter(feuilleDuSite).sort()) for (const v of theme.lireVariables(f[fichier] as string)) site.push({ fichier, ...v })
  const definies = f[theme.FICHIER_THEME] !== undefined ? theme.lireVariables(f[theme.FICHIER_THEME] as string) : []
  const bifrost = theme.VARIABLES_BIFROST.map((v) => {
    const x = definies.find((y) => y.nom === v.nom)
    return { fichier: theme.FICHIER_THEME, nom: v.nom, libelle: v.libelle, defaut: v.valeur, valeur: x?.valeur ?? v.valeur, definie: !!x }
  })
  return { site, bifrost }
}

/** Écrit des variables du thème. Les --bf-… vont dans assets/bf-theme.css, créé au besoin et lié à toutes les pages. */
export function ecrireTheme(f: Fichiers, modifs: { fichier: string; nom: string; valeur: string }[]): Changements {
  const parFichier = new Map<string, { nom: string; valeur: string }[]>()
  for (const m of modifs) {
    if (!m.fichier.endsWith('.css')) throw Errors.badRequest('Fichier de thème invalide')
    if (m.fichier === theme.FICHIER_THEME && !theme.VARIABLES_BIFROST.some((v) => v.nom === m.nom)) throw Errors.badRequest(`Variable inconnue : ${m.nom}`)
    if (!theme.valeurValide(m.valeur)) throw Errors.badRequest(`Valeur refusée pour ${m.nom}`)
    parFichier.set(m.fichier, [...(parFichier.get(m.fichier) ?? []), m])
  }
  const ecrits: Fichiers = {}
  for (const [fichier, vars] of parFichier) {
    const nouveau = fichier === theme.FICHIER_THEME && f[fichier] === undefined
    if (!nouveau && f[fichier] === undefined) throw Errors.badRequest(`Feuille introuvable : ${fichier}`)
    let css = nouveau ? '/* Thème des sections Bifrost : réglé depuis le mode dev (onglet Thème). */\n' : f[fichier] as string
    try {
      for (const v of vars) css = theme.ecrireVariable(css, v.nom, v.valeur)
    } catch (e) {
      throw Errors.badRequest((e as Error).message)
    }
    ecrits[fichier] = css
    if (fichier === theme.FICHIER_THEME) {
      for (const p of pagesDe(f)) {
        const lie = modeDev.lierFeuilleBlocs(f[p] as string, p, theme.FICHIER_THEME)
        if (lie !== f[p]) ecrits[p] = lie
      }
    }
  }
  return { ecrits, supprimes: [] }
}

/** Chemin sûr dans un ensemble de fichiers envoyé par un client. */
export function cheminValide(p: string): boolean {
  const n = path.posix.normalize(p)
  return n === p && !n.startsWith('..') && !n.startsWith('/') && !/(^|\/)\.\.(\/|$)/.test(n) && n.length <= 300
}
