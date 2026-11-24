import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import os from 'os'
import path from 'path'
import { zipSync, strToU8 } from 'fflate'
import { analyser } from './flags.service'

let racine = ''
let f: typeof import('./site-fichiers.service')

const page = (titre: string, contenu: string) => `<!DOCTYPE html><html lang="fr"><head><title>${titre} | Club</title></head><body><header><nav><ul><li><a href="index.html">Accueil</a></li></ul></nav></header><main>${contenu}</main><footer><p data-bf="pied.texte">Pied</p></footer></body></html>`

beforeAll(async () => {
  racine = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-rubriques-'))
  process.env.SITES_DIR = racine
  f = await import('./site-fichiers.service')
})
afterAll(() => fs.rm(racine, { recursive: true, force: true }))

const lire = (site: string, p: string) => fs.readFile(path.join(f.dossiers(site).brouillon, p), 'utf-8')

describe('rubriques', () => {
  it('crée une rubrique vide, sa page modèle et la page de tous les articles', async () => {
    await f.importerZip('r', zipSync({ 'index.html': strToU8(page('Accueil', '<h1 data-bf="accueil.titre">Bienvenue</h1>')) }))
    const r = await f.creerRubrique('r', 'index.html', null, 'dedans', { libelle: 'Blog', champs: ['photo', 'date', 'resume', 'texte', 'auteur'], limite: 3, pageComplete: true })
    expect(r.nom).toBe('blog')
    expect(r.pageListe).toBe('blog.html')
    const accueil = await lire('r', 'index.html')
    expect(accueil).toContain('data-bf-liste="blog" data-bf-limite="3"')
    expect(accueil).toContain('bifrost-blocs.css')
    const modele = await lire('r', 'blog/_modele.html')
    expect(modele).toContain('data-bf-page="blog"')
    expect(modele).toContain('data-bf-libelle="Blog"')
    expect(modele).toContain('data-bf="auteur"')
    expect(modele).toContain('noindex')
    expect(modele).toContain('href="../blog.html"') // retour vers tous les articles
    expect(modele).toContain('Pied')
    expect(await lire('r', 'blog.html')).toMatch(/<h1 data-bf="blog[^"]*\.titre">Blog<\/h1>/)
    expect(await f.listerRubriques('r')).toEqual([{ nom: 'blog', libelle: 'Blog', champs: ['photo', 'date', 'texte', 'auteur'] }])
  })

  it('le premier article remplit les listes vides, avec ses champs', async () => {
    const { page: p } = await f.nouvelElement('r', 'blog', { titre: 'Course de côte', date: '2026-11-20', texte: '<p>Un beau week-end</p>', photos: [], auteur: 'Ragna' })
    expect(p).toBe('blog/course-de-cote.html')
    const article = await lire('r', p)
    expect(article).toContain('Course de côte')
    expect(article).toContain('<span data-bf="auteur">Ragna</span>')
    expect(article).not.toContain('noindex')
    for (const liste of ['index.html', 'blog.html']) {
      const h = await lire('r', liste)
      expect(h).toContain('href="blog/course-de-cote.html"')
      expect(h).toContain('datetime="2026-11-20"')
      expect(h).toContain('Un beau week-end')
    }
  })

  it('changer le titre d’un article ne touche que lui, et sa carte suit', async () => {
    await f.nouvelElement('r', 'blog', { titre: 'Deuxième', date: '2026-11-21', photos: [] })
    await f.modifierChamp('r', 'titre', 'Course de côte de Laval', 'blog/course-de-cote.html')
    expect(await lire('r', 'blog/course-de-cote.html')).toContain('Course de côte de Laval')
    expect(await lire('r', 'blog/deuxieme.html')).toContain('<h1 data-bf="titre">Deuxième</h1>')
    expect(await lire('r', 'blog.html')).toContain('Course de côte de Laval')
    expect(await lire('r', 'index.html')).toContain('Course de côte de Laval')
  })

  it('supprimer tous les articles garde de quoi en ajouter un nouveau', async () => {
    await f.operationListe('r', 'blog.html', 'blog', { op: 'supprimer', index: 0 })
    await f.operationListe('r', 'blog.html', 'blog', { op: 'supprimer', index: 0 })
    expect(existsSync(path.join(f.dossiers('r').brouillon, 'blog/deuxieme.html'))).toBe(false)
    expect(analyser(await lire('r', 'blog.html'), 'blog.html').listes.find((l) => l.nom === 'blog')?.elements).toEqual([])
    await f.nouvelElement('r', 'blog', { titre: 'Retour', photos: [] })
    expect(await lire('r', 'blog.html')).toContain('href="blog/retour.html"')
    expect(await lire('r', 'index.html')).toContain('href="blog/retour.html"')
  })
})

describe('fils', () => {
  it('mélange les rubriques, du plus récent au plus ancien, et suit les changements', async () => {
    await f.importerZip('m', zipSync({ 'index.html': strToU8(page('Accueil', '<h1>Accueil</h1>')) }))
    await f.creerRubrique('m', 'index.html', null, 'dedans', { libelle: 'Blog', champs: ['date', 'resume', 'texte'], limite: null, pageComplete: false })
    await f.creerRubrique('m', 'index.html', null, 'dedans', { libelle: 'Instagram', champs: ['photo', 'date', 'texte'], limite: null, pageComplete: false })
    await f.nouvelElement('m', 'blog', { titre: 'Ancien', date: '2026-01-05', photos: [] })
    await f.nouvelElement('m', 'instagram', { titre: 'Récent', date: '2026-11-01', photos: [] })
    await f.nouvelElement('m', 'blog', { titre: 'Milieu', date: '2026-06-10', photos: [] })
    await f.insererFil('m', 'index.html', null, 'dedans', { rubriques: ['blog', 'instagram', 'inconnue'], titre: 'Quoi de neuf', limite: 2 })
    let h = await lire('m', 'index.html')
    expect(h).toContain('data-bf-fil="blog,instagram"')
    const fil = h.slice(h.indexOf('data-bf-fil='))
    const ordre = ['Récent', 'Milieu', 'Ancien'].map((t) => fil.indexOf(`>${t}<`))
    expect(ordre[0]).toBeGreaterThan(-1)
    expect(ordre[1]).toBeGreaterThan(ordre[0] as number)
    expect(ordre[2]).toBe(-1) // limite 2
    expect(fil).toContain('>Instagram<') // badge de la rubrique
    expect(fil).toContain('href="instagram/recent.html"')
    await f.nouvelElement('m', 'blog', { titre: 'Tout neuf', date: '2026-11-23', photos: [] })
    h = await lire('m', 'index.html')
    const fil2 = h.slice(h.indexOf('data-bf-fil='))
    expect(fil2.indexOf('>Tout neuf<')).toBeLessThan(fil2.indexOf('>Récent<'))
    expect(fil2).not.toContain('>Milieu<')
  })

  it('refuse un fil sans rubrique existante', async () => {
    await expect(f.insererFil('m', 'index.html', null, 'dedans', { rubriques: ['rien'], titre: 'X', limite: null })).rejects.toThrow()
  })
})
