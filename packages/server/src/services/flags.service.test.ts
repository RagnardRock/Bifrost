import { describe, it, expect } from 'vitest'
import * as f from './flags.service'

const page = `<!doctype html><html><head><title>Accueil | Site</title></head><body>
<h1 data-bf="accueil.titre">Bonjour</h1>
<p data-bf="contact.tel">04 00</p>
<img src="assets/a.svg" data-bf="accueil.photo">
<div data-bf="bloc" data-bf-type="riche"><p>Texte <strong>gras</strong></p><span data-bf="dedans">x</span></div>
<div data-bf-liste="actualites" data-bf-limite="2">
  <article data-bf-element><img src="assets/a.svg" data-bf="photo"><time data-bf="date">1 janvier 2026</time><h3 data-bf="titre"><a href="actualites/un.html">Un</a></h3></article>
  <article data-bf-element><img src="assets/a.svg" data-bf="photo"><time data-bf="date"></time><h3 data-bf="titre"><a href="actualites/deux.html">Deux</a></h3></article>
</div>
<ul data-bf-liste="ateliers"><li data-bf-element data-bf="nom">Yoga</li><li data-bf-element data-bf="nom">Cuisine</li></ul>
</body></html>`

describe('flags', () => {
  it('lit les champs, les listes et devine les types', () => {
    const a = f.analyser(page, 'index.html')
    expect(a.champs.map((c) => [c.cle, c.type])).toEqual([
      ['accueil.titre', 'texte'], ['contact.tel', 'texte'], ['accueil.photo', 'image'], ['bloc', 'riche'],
    ])
    const actus = a.listes.find((l) => l.nom === 'actualites')!
    expect(actus.limite).toBe(2)
    expect(actus.elements[0]!.find((c) => c.cle === 'titre')!.valeur).toBe('Un')
    expect(a.listes.find((l) => l.nom === 'ateliers')!.elements.map((e) => e[0]!.valeur)).toEqual(['Yoga', 'Cuisine'])
  })

  it('modifie un texte sans casser le lien qu’il contient', () => {
    const { html } = f.operationListe(page, 'index.html', 'actualites', { op: 'modifier', index: 0, cle: 'titre', valeur: 'Nouveau <b>titre</b>' })
    expect(html).toContain('<a href="actualites/un.html">Nouveau &lt;b&gt;titre&lt;/b&gt;</a>')
  })

  it('modifie le texte propre d’un champ qui en contient un autre', () => {
    const h = '<details><summary data-bf="t">Présentation<small data-bf="r">Histoire</small></summary></details>'
    expect(f.analyser(h).champs.map((c) => c.valeur)).toEqual(['Présentation', 'Histoire'])
    const { html } = f.modifierChamp(h, 'index.html', 't', 'Qui & quoi')
    expect(html).toContain('<summary data-bf="t">Qui &amp; quoi<small data-bf="r">Histoire</small></summary>')
  })

  it('nettoie le texte riche', () => {
    const { html } = f.modifierChamp(page, 'index.html', 'bloc', '<p onclick="x()">Ok<script>alert(1)</script></p>')
    expect(html).toContain('<p>Ok</p>')
    expect(html).not.toContain('script')
    expect(html).not.toContain('onclick')
  })

  it('écrit une image avec un chemin relatif à la page', () => {
    const { html } = f.modifierChamp(page, 'actualites/x.html', 'accueil.photo', 'medias/p.webp')
    expect(html).toContain('src="../medias/p.webp"')
  })

  it('déplace, duplique et supprime un élément', () => {
    let h = f.operationListe(page, 'index.html', 'ateliers', { op: 'deplacer', index: 1, vers: 0 }).html
    expect(f.analyser(h).listes.find((l) => l.nom === 'ateliers')!.elements.map((e) => e[0]!.valeur)).toEqual(['Cuisine', 'Yoga'])
    h = f.operationListe(h, 'index.html', 'ateliers', { op: 'dupliquer', index: 0 }).html
    h = f.operationListe(h, 'index.html', 'ateliers', { op: 'supprimer', index: 2 }).html
    expect(f.analyser(h).listes.find((l) => l.nom === 'ateliers')!.elements.map((e) => e[0]!.valeur)).toEqual(['Cuisine', 'Cuisine'])
  })

  it('ajoute en tête et respecte la limite', () => {
    const { html } = f.ajouterEnTete(page, 'index.html', 'actualites', { titre: 'Fête', date: '2026-11-18', photos: ['medias/f.webp'], page: 'actualites/fete.html' })
    const els = f.analyser(html).listes.find((l) => l.nom === 'actualites')!.elements
    expect(els).toHaveLength(2)
    expect(els[0]!.find((c) => c.cle === 'titre')!.valeur).toBe('Fête')
    expect(els[0]!.find((c) => c.cle === 'date')!.valeur).toBe('18 novembre 2026')
    expect(html).toContain('href="actualites/fete.html"')
    expect(html).toContain('datetime="2026-11-18"')
  })

  it('ramène et replace les chemins d’une page à l’autre', () => {
    expect(f.versRacine('../medias/a.webp', 'actualites')).toBe('medias/a.webp')
    expect(f.depuisRacine('medias/a.webp', 'actualites')).toBe('../medias/a.webp')
    expect(f.depuisRacine('https://x.fr/a.png', 'actualites')).toBe('https://x.fr/a.png')
  })
})
