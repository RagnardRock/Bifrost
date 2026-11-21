import { describe, it, expect } from 'vitest'
import * as o from './outils.service'

const page = (titre: string, extra = '') => `<!doctype html>
<html><head><title>${titre} | Site</title><link rel="stylesheet" href="assets/style.css"></head>
<body><nav><ul><li><a href="index.html">Accueil</a></li>${extra}</ul></nav><main><h1>${titre}</h1></main></body></html>`

const site = (): o.Fichiers => ({
  'index.html': page('Accueil', '<li><a href="tarifs.html">Tarifs</a></li>'),
  'tarifs.html': page('Tarifs', '<li><a href="tarifs.html">Tarifs</a></li>'),
  'assets/style.css': ':root {\n  --vert: #2f5d50;\n}\nbody { color: var(--vert); }\n',
})

describe('outils du mode dev sur des fichiers en mémoire', () => {
  it('crée une page, ajoutée au menu de toutes les pages, avec la feuille des blocs', async () => {
    const r = await o.creerPage(site(), { titre: 'Contact', menu: true })
    expect(r.page).toBe('contact.html')
    expect(r.menus).toBe(3)
    expect(Object.keys(r.ecrits).sort()).toEqual(['assets/bifrost-blocs.css', 'contact.html', 'index.html', 'tarifs.html'])
    expect(r.ecrits['contact.html']).toContain('href="assets/bifrost-blocs.css"')
    await expect(o.creerPage(site(), { titre: 'Tarifs', menu: false })).rejects.toThrow(/existe déjà/)
  })

  it('renomme et supprime une page', () => {
    const r = o.renommerPage(site(), 'tarifs.html', 'prix.html')
    expect(r.supprimes).toEqual(['tarifs.html'])
    expect(r.ecrits['index.html']).toContain('href="prix.html"')
    expect(r.ecrits['prix.html']).toContain('href="prix.html"')
    expect(() => o.renommerPage(site(), 'index.html', 'a.html')).toThrow()
    const s = o.supprimerPage(site(), 'tarifs.html')
    expect(s.supprimes).toEqual(['tarifs.html'])
    expect(s.ecrits['index.html']).not.toContain('tarifs.html')
  })

  it('lit et écrit le thème, crée bf-theme.css et le lie aux pages', () => {
    expect(o.lireTheme(site()).site).toEqual([{ fichier: 'assets/style.css', nom: '--vert', valeur: '#2f5d50' }])
    const r = o.ecrireTheme(site(), [{ fichier: 'assets/style.css', nom: '--vert', valeur: '#123456' }, { fichier: 'assets/bf-theme.css', nom: '--bf-rayon', valeur: '4px' }])
    expect(r.ecrits['assets/style.css']).toContain('--vert: #123456;')
    expect(r.ecrits['assets/bf-theme.css']).toContain('--bf-rayon: 4px')
    expect(r.ecrits['index.html']).toContain('href="assets/bf-theme.css"')
    expect(() => o.ecrireTheme(site(), [{ fichier: 'assets/style.css', nom: '--vert', valeur: 'red;}' }])).toThrow()
  })

  it('refuse les chemins qui sortent du dossier', () => {
    expect(o.cheminValide('a/b.html')).toBe(true)
    expect(o.cheminValide('../x.html')).toBe(false)
    expect(o.cheminValide('/etc/passwd')).toBe(false)
    expect(o.cheminValide('a/../../x')).toBe(false)
  })
})
