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

describe('liens d’appel et d’e-mail', () => {
  it('le numéro du lien tel: suit le texte, partout sur la page', () => {
    const html = '<a href="tel:+33471004187" data-bf="contact.telephone">04 71 00 41 87</a><p data-bf="contact.telephone"><a href="tel:0471004187">04 71 00 41 87</a></p>'
    const r = f.modifierChamp(html, 'index.html', 'contact.telephone', '04 71 22 33 44')
    expect(r.touches).toBe(2)
    expect(r.html).toContain('href="tel:+33471223344" data-bf="contact.telephone">04 71 22 33 44</a>')
    expect(r.html).toContain('href="tel:0471223344">04 71 22 33 44</a>')
  })

  it('les autres liens vers le même numéro suivent (bouton « Appeler »), pas les autres numéros', () => {
    const html = '<a href="tel:+33471004187" data-bf="contact.telephone">04 71 00 41 87</a><a class="bouton" href="tel:+33471004187">Appeler</a><a href="tel:+33471638822">Hébergeur</a>'
    const r = f.modifierChamp(html, 'index.html', 'contact.telephone', '04 71 22 33 44')
    expect(r.html).toContain('<a class="bouton" href="tel:+33471223344">Appeler</a>')
    expect(r.html).toContain('<a href="tel:+33471638822">Hébergeur</a>')
  })

  it('l’adresse du lien mailto: suit le texte si c’est une adresse', () => {
    const html = '<a href="mailto:a@ex.fr?subject=Bonjour" data-bf="contact.email">a@ex.fr</a>'
    expect(f.modifierChamp(html, 'index.html', 'contact.email', 'accueil@ex.fr').html).toContain('href="mailto:accueil@ex.fr?subject=Bonjour"')
    expect(f.modifierChamp(html, 'index.html', 'contact.email', 'Écrivez-nous').html).toContain('href="mailto:a@ex.fr?subject=Bonjour"')
  })

  it('un texte qui n’est pas un numéro ne touche pas au lien', () => {
    expect(f.lienTelephone('Appelez-nous')).toBeNull()
    expect(f.lienTelephone('+41 22 123 45 67', 'tel:+33')).toBe('tel:+41221234567')
  })
})

describe('page depuis le modèle : lien vers l’original', () => {
  const modele = '<main data-bf-page="actus"><h1 data-bf="titre">T</h1><div data-bf="texte" data-bf-type="riche"><p>x</p></div></main>'
  it('ajoute « Voir sur Instagram » sous le texte, en https seulement', () => {
    const html = f.pageDepuisModele(modele, { titre: 'Sortie', texte: '<p>Bonjour</p>', photos: [], page: 'actus/sortie.html', source: { url: 'https://www.instagram.com/p/abc/', libelle: 'Voir sur Instagram' } })
    expect(html).toContain('<p>Bonjour</p><p><a target="_blank" rel="noopener" href="https://www.instagram.com/p/abc/">Voir sur Instagram</a></p>')
    const sansLien = f.pageDepuisModele(modele, { titre: 'Sortie', texte: '<p>Bonjour</p>', photos: [], page: 'actus/sortie.html', source: { url: 'javascript:alert(1)', libelle: 'x' } })
    expect(sansLien).not.toContain('javascript:')
  })
})

describe('texte avec mise en forme', () => {
  const h = '<h1 data-bf="t">Une maison, <em>au bord du lac</em></h1>'
  it('lit et garde l’italique', () => {
    expect(f.analyser(h).champs[0]?.valeur).toBe('Une maison, <em>au bord du lac</em>')
    const { html } = f.modifierChamp(h, 'index.html', 't', 'Une belle maison, <em>au bord du lac</em><script>x()</script><a href="x">l</a>')
    expect(html).toContain('<h1 data-bf="t">Une belle maison, <em>au bord du lac</em>l</h1>')
  })
  it('un texte simple reste du texte', () => {
    const { html } = f.modifierChamp('<p data-bf="t">Bonjour</p>', 'index.html', 't', '<em>x</em>')
    expect(html).toContain('&lt;em&gt;x&lt;/em&gt;')
  })
})
