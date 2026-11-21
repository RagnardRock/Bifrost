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
