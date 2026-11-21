import { describe, it, expect } from 'vitest'
import * as d from './mode-dev.service'

const page = `<!doctype html><html><head><title>T</title></head><body>
<header><h1>Bienvenue</h1><p>Intro</p></header>
<section id="tarifs"><h2>Tarifs</h2><ul><li>A</li><li>B</li></ul><img src="a.jpg"></section>
<script src="x.js"></script>
</body></html>`

const h1 = { chemin: [0, 0], balises: ['header', 'h1'] }
const ul = { chemin: [1, 1], balises: ['section', 'ul'] }
const li0 = { chemin: [1, 1, 0], balises: ['section', 'ul', 'li'] }
const img = { chemin: [1, 2], balises: ['section', 'img'] }

describe('mode dev', () => {
  it('pose et retire un flag', () => {
    let { html } = d.operation(page, h1, { op: 'flags', flags: { 'data-bf': 'accueil.titre' } })
    expect(html).toContain('<h1 data-bf="accueil.titre">Bienvenue</h1>')
    html = d.operation(html, h1, { op: 'flags', flags: { 'data-bf-type': 'riche' } }).html
    expect(html).toContain('data-bf-type="riche"')
    html = d.operation(html, h1, { op: 'flags', flags: { 'data-bf': null } }).html
    expect(html).toContain('<h1>Bienvenue</h1>')
  })

  it('transforme une liste HTML en liste Bifrost', () => {
    let { html } = d.operation(page, ul, { op: 'flags', flags: { 'data-bf-liste': 'tarifs', 'data-bf-limite': 3 } })
    html = d.operation(html, li0, { op: 'flags', flags: { 'data-bf-element': true, 'data-bf': 'nom' } }).html
    expect(html).toContain('<ul data-bf-liste="tarifs" data-bf-limite="3"><li data-bf="nom" data-bf-element="">A</li>')
  })

  it('refuse un nom de flag invalide', () => {
    expect(() => d.operation(page, h1, { op: 'flags', flags: { 'data-bf': 'a"b' } })).toThrow(/Nom invalide/)
  })

  it('refuse si la page a changé', () => {
    expect(() => d.operation(page, { chemin: [0, 0], balises: ['header', 'h2'] }, { op: 'supprimer' })).toThrow(/a changé/)
    expect(() => d.operation(page, { chemin: [9], balises: ['div'] }, { op: 'supprimer' })).toThrow()
  })

  it('modifie un texte (échappé) mais pas un élément qui en contient d’autres', () => {
    const { html } = d.operation(page, h1, { op: 'texte', valeur: 'Bonjour <b>&</b>' })
    expect(html).toContain('<h1>Bonjour &lt;b&gt;&amp;&lt;/b&gt;</h1>')
    expect(() => d.operation(page, ul, { op: 'texte', valeur: 'x' })).toThrow()
  })

  it('règle le alt d’une image et refuse un lien javascript', () => {
    expect(d.operation(page, img, { op: 'attribut', nom: 'alt', valeur: 'Façade' }).html).toContain('<img src="a.jpg" alt="Façade">')
    expect(() => d.operation(page, h1, { op: 'attribut', nom: 'href', valeur: 'javascript:alert(1)' })).toThrow()
  })

  it('duplique, déplace et supprime en renvoyant la nouvelle sélection', () => {
    let r = d.operation(page, li0, { op: 'dupliquer' })
    expect(r.chemin).toEqual([1, 1, 1])
    expect(r.html).toContain('<ul><li>A</li><li>A</li><li>B</li></ul>')
    r = d.operation(page, li0, { op: 'deplacer', sens: 'bas' })
    expect(r.chemin).toEqual([1, 1, 1])
    expect(r.html).toContain('<ul><li>B</li><li>A</li></ul>')
    r = d.operation(page, li0, { op: 'deplacer', sens: 'haut' })
    expect(r.chemin).toEqual([1, 1, 0])
    r = d.operation(page, li0, { op: 'supprimer' })
    expect(r.chemin).toBeNull()
    expect(r.html).toContain('<ul><li>B</li></ul>')
  })

  it('ne fait pas passer une section sous les scripts de fin de page', () => {
    const section = { chemin: [1], balises: ['section'] }
    const r = d.operation(page, section, { op: 'deplacer', sens: 'bas' })
    expect(r.chemin).toEqual([1])
  })
})

describe('sections toutes faites', () => {
  const bloc = `<section class="bfb"><h2 data-bf="galerie.titre">En images</h2>
<ul data-bf-liste="galerie"><li data-bf-element><img data-bf="photo" src="assets/x.svg"></li></ul></section>`

  it('renomme les clés déjà prises dans le site, pas celles des éléments', () => {
    const pris = d.prefixes('<h2 data-bf="galerie.titre"></h2><ul data-bf-liste="galerie-2"></ul>')
    const r = d.renommerBloc(bloc, pris)
    expect(r).toContain('data-bf="galerie-3.titre"')
    expect(r).toContain('data-bf-liste="galerie-3"')
    expect(r).toContain('data-bf="photo"')
    expect(d.renommerBloc(bloc, new Set())).toContain('data-bf="galerie.titre"')
  })

  it('insère avant, après ou dans un élément, avec des chemins relatifs à la page', () => {
    let r = d.inserer(page, 'index.html', { chemin: [1], balises: ['section'] }, bloc, 'avant')
    expect(r.chemin).toEqual([1])
    expect(r.html.indexOf('En images')).toBeLessThan(r.html.indexOf('Tarifs'))
    r = d.inserer(page, 'actualites/a.html', { chemin: [0], balises: ['header'] }, bloc, 'apres')
    expect(r.chemin).toEqual([1])
    expect(r.html).toContain('src="../assets/x.svg"')
    r = d.inserer(page, 'index.html', null, bloc, 'dedans')
    expect(r.html).toMatch(/En images[\s\S]*<\/section>\s*<\/body>/)
  })

  it('déplace un élément vers un autre endroit de la page', () => {
    const r = d.operation(page, img, { op: 'deplacer-vers', vers: { chemin: [0], balises: ['header'] }, position: 'dedans' })
    expect(r.chemin).toEqual([0, 2])
    expect(r.html).toContain('<p>Intro</p><img src="a.jpg"></header>')
    expect(() => d.operation(page, { chemin: [1], balises: ['section'] }, { op: 'deplacer-vers', vers: ul, position: 'dedans' })).toThrow(/lui-même/)
  })

  it('lie la feuille des blocs une seule fois, et extrait un élément pour en faire un bloc', () => {
    const h = d.lierFeuilleBlocs(page, 'actualites/a.html')
    expect(h).toContain('<link rel="stylesheet" href="../assets/bifrost-blocs.css">')
    expect(d.lierFeuilleBlocs(h, 'actualites/a.html')).toBe(h)
    expect(d.extraire(page.replace('a.jpg', '../medias/a.jpg'), 'actualites/a.html', img)).toBe('<img src="medias/a.jpg">')
  })
})

describe('classes CSS', () => {
  it('règle les classes d’un élément et refuse les caractères spéciaux', () => {
    const r = d.operation(page, { chemin: [1], balises: ['section'] }, { op: 'attribut', nom: 'class', valeur: 'section--sombre large' })
    expect(r.html).toContain('<section id="tarifs" class="section--sombre large">')
    expect(() => d.operation(page, { chemin: [1], balises: ['section'] }, { op: 'attribut', nom: 'class', valeur: 'a" onclick="x' })).toThrow()
  })
})
