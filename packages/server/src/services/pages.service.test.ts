import { describe, it, expect } from 'vitest'
import * as p from './pages.service'

const accueil = `<!doctype html><html><head><title>Accueil | Plomberie Martin</title><link rel="stylesheet" href="assets/style.css"></head><body>
<header><nav><ul><li><a href="index.html" data-bf="menu.accueil" aria-current="page">Accueil</a></li><li><a href="tarifs.html#prix" data-bf="menu.tarifs">Tarifs</a></li></ul></nav></header>
<main><section><h1 data-bf="accueil.titre">Bienvenue</h1><a href="tarifs.html">Voir les tarifs</a></section></main>
<footer><img src="assets/logo.png"></footer>
</body></html>`

describe('pages', () => {
  it('vérifie les noms de page', () => {
    expect(p.verifierChemin('Services/Plomberie.html')).toBe('services/plomberie.html')
    expect(() => p.verifierChemin('../x.html')).toThrow()
    expect(() => p.verifierChemin('a b.html')).toThrow()
    expect(p.cheminPour('Nos réalisations')).toBe('nos-realisations.html')
  })

  it('crée une page qui garde en-tête et pied de page, chemins suivis dans un sous-dossier', () => {
    const h = p.nouvellePage(accueil, 'index.html', 'services/chauffage.html', 'Chauffage')
    expect(h).toContain('<title>Chauffage | Plomberie Martin</title>')
    expect(h).toContain('href="../assets/style.css"')
    expect(h).toContain('src="../assets/logo.png"')
    expect(h).toContain('data-bf="chauffage.titre">Chauffage</h1>')
    expect(h).not.toContain('Bienvenue')
    expect(h).not.toContain('aria-current')
  })

  it('ajoute la page au menu une seule fois, avec une clé de menu', () => {
    const h = p.ajouterAuMenu(accueil, 'index.html', 'contact.html', 'Contact') as string
    expect(h).toContain('<li><a href="contact.html" data-bf="menu.contact">Contact</a></li></ul>')
    expect(p.ajouterAuMenu(h, 'index.html', 'contact.html', 'Contact')).toBeNull()
    expect(p.ajouterAuMenu('<p>sans menu</p>', 'index.html', 'contact.html', 'Contact')).toBeNull()
  })

  it('retire une page du menu et compte les autres liens', () => {
    const r = p.retirerDuMenu(accueil, 'index.html', 'tarifs.html')
    expect(r.retires).toBe(1)
    expect(r.autres).toBe(1)
    expect(r.html).not.toContain('menu.tarifs')
  })

  it('fait suivre les liens d’une page renommée, ancre comprise', () => {
    const r = p.suivreRenommage(accueil, 'index.html', 'tarifs.html', 'prix/tarifs-2026.html')
    expect(r.touches).toBe(2)
    expect(r.html).toContain('href="prix/tarifs-2026.html#prix"')
    expect(p.deplacerPage(accueil, 'index.html', 'a/index2.html')).toContain('href="../assets/style.css"')
  })

  it('vide les listes en gardant un élément et repère les pages liées', () => {
    const h = `<ul data-bf-liste="actus"><li data-bf-element><a href="actualites/a.html">A</a></li><li data-bf-element><a href="actualites/b.html">B</a></li></ul>`
    const r = p.viderListes(h, 'index.html')
    expect(r.html).toContain('actualites/a.html')
    expect(r.html).not.toContain('actualites/b.html')
    expect(r.pagesRetirees).toEqual(['actualites/b.html'])
    expect(p.liensDe(accueil, 'index.html').sort()).toEqual(['index.html', 'tarifs.html'])
  })
})

describe('retouches sur place', () => {
  const ecrit = `<!doctype html>
<html lang="fr">
<head>
  <link rel="preconnect" href="https://x" crossorigin>
  <title>Accueil | Site</title>
</head>
<body>
  <nav>
    <ul>
      <li><a href="index.html">Accueil</a></li>
      <li><a href="tarifs.html">Tarifs</a></li>
    </ul>
  </nav>
  <main>
    <p>A &amp; B</p>
  </main>
</body>
</html>
`
  it('ne touche qu’aux lignes concernées', () => {
    const h = p.ajouterAuMenu(ecrit, 'index.html', 'contact.html', 'Contact') as string
    expect(h).toBe(ecrit.replace('      <li><a href="tarifs.html">Tarifs</a></li>\n', '      <li><a href="tarifs.html">Tarifs</a></li>\n      <li><a href="contact.html">Contact</a></li>\n'))
    expect(p.retirerDuMenu(ecrit, 'index.html', 'tarifs.html').html).toBe(ecrit.replace('      <li><a href="tarifs.html">Tarifs</a></li>\n', ''))
    expect(p.suivreRenommage(ecrit, 'index.html', 'tarifs.html', 'prix.html').html).toBe(ecrit.replace('tarifs.html', 'prix.html'))
  })

  it('garde l’en-tête de la page copiée tel quel', () => {
    const h = p.nouvellePage(ecrit, 'index.html', 'contact.html', 'Contact')
    expect(h.startsWith('<!doctype html>\n<html lang="fr">\n<head>\n  <link rel="preconnect" href="https://x" crossorigin>\n  <title>Contact | Site</title>')).toBe(true)
    expect(h).not.toContain('A &amp; B')
    expect(h).toContain('data-bf="contact.titre">Contact</h1>')
  })
})
