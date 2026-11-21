/**
 * Bibliothèque de sections pour le mode dev.
 * - Blocs fournis : packages/server/blocs/<id>.html
 * - Blocs enregistrés par le dev : <SITES_DIR>/_blocs/perso-<id>.html (dans le volume des sites, donc sauvegardés avec eux)
 * Chaque fichier commence par un commentaire JSON : <!-- {"nom": "…", "icone": "…", "description": "…"} -->
 * Les chemins (src, href) d'un bloc sont écrits depuis la racine du site.
 */
import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { nanoid } from 'nanoid'
import { config } from '../config'
import { Errors } from '../utils/errors'
import { slugifier } from './flags.service'

export interface Bloc { id: string; nom: string; icone: string; description: string; perso: boolean }

export const dossierBlocsFournis = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../blocs')
export const dossierBlocsPerso = () => path.join(config.sitesDir, '_blocs')
export const feuilleBlocs = () => path.join(dossierBlocsFournis, 'bifrost-blocs.css')

/** Ordre d'affichage des blocs fournis (les autres suivent, par ordre alphabétique). */
const ORDRE = ['entete', 'texte', 'texte-photo', 'cartes', 'galerie', 'equipe', 'logos', 'faq', 'horaires', 'contact']

function lireEntete(contenu: string): { meta: Omit<Bloc, 'id' | 'perso'>; html: string } {
  const m = /^\s*<!--\s*(\{[\s\S]*?\})\s*-->\s*/.exec(contenu)
  let meta = { nom: 'Bloc', icone: '▫️', description: '' }
  if (m) { try { meta = { ...meta, ...JSON.parse(m[1] as string) } } catch { /* entête illisible : valeurs par défaut */ } }
  return { meta, html: m ? contenu.slice(m[0].length).trim() : contenu.trim() }
}

const fichierBloc = (id: string) => {
  if (!/^(perso-)?[a-z0-9-]{1,80}$/.test(id)) throw Errors.badRequest('Bloc inconnu')
  return id.startsWith('perso-') ? path.join(dossierBlocsPerso(), `${id}.html`) : path.join(dossierBlocsFournis, `${id}.html`)
}

export async function lister(): Promise<Bloc[]> {
  const res: Bloc[] = []
  for (const [dossier, perso] of [[dossierBlocsFournis, false], [dossierBlocsPerso(), true]] as const) {
    if (!existsSync(dossier)) continue
    const fichiers = (await fs.readdir(dossier)).filter((f) => f.endsWith('.html'))
    const blocs = await Promise.all(fichiers.map(async (f) => {
      const { meta } = lireEntete(await fs.readFile(path.join(dossier, f), 'utf-8'))
      return { id: f.replace(/\.html$/, ''), perso, ...meta }
    }))
    const rang = (b: Bloc) => { const i = ORDRE.indexOf(b.id); return i < 0 ? ORDRE.length : i }
    res.push(...blocs.sort((a, b) => perso ? a.nom.localeCompare(b.nom, 'fr') : rang(a) - rang(b) || a.id.localeCompare(b.id)))
  }
  return res
}

export async function lire(id: string): Promise<string> {
  try {
    return lireEntete(await fs.readFile(fichierBloc(id), 'utf-8')).html
  } catch {
    throw Errors.notFound('Bloc')
  }
}

export async function enregistrer(nom: string, html: string, description = ''): Promise<Bloc> {
  const id = `perso-${slugifier(nom).slice(0, 40)}-${nanoid(6).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`
  const meta = { nom: nom.trim().slice(0, 60), icone: '⭐', description: description.trim().slice(0, 160) }
  await fs.mkdir(dossierBlocsPerso(), { recursive: true })
  // « --> » dans le JSON fermerait le commentaire
  await fs.writeFile(fichierBloc(id), `<!-- ${JSON.stringify(meta).replace(/-->/g, '--\\u003e')} -->\n${html}\n`, 'utf-8')
  return { id, perso: true, ...meta }
}

export async function supprimer(id: string) {
  if (!id.startsWith('perso-')) throw Errors.badRequest('Les blocs fournis avec Bifrost ne se suppriment pas')
  await fs.rm(fichierBloc(id), { force: true })
  return { ok: true }
}
