import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { zipSync, strToU8 } from 'fflate'

let racine = ''
let f: typeof import('./site-fichiers.service')

beforeAll(async () => {
  racine = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-chg-'))
  process.env.SITES_DIR = racine
  f = await import('./site-fichiers.service')
})
afterAll(() => fs.rm(racine, { recursive: true, force: true }))

const page = (titre: string) => `<nav><a href="index.html" data-bf="menu-accueil">Accueil</a></nav><h1 data-bf="titre">${titre}</h1>`
  + '<ul data-bf-liste="actus"><li data-bf-element><span data-bf="t">Une</span></li></ul>'

describe('changements', () => {
  it('un menu recopié dans toutes les pages compte pour une modification', async () => {
    const fichiers: Record<string, Uint8Array> = {}
    for (let i = 0; i < 5; i++) fichiers[`p${i}.html`] = strToU8(page(`Page ${i}`))
    await f.importerZip('s1', zipSync(fichiers))
    const r = await f.modifierChamp('s1', 'menu-accueil', 'Bienvenue')
    expect(r.pages).toHaveLength(5)
    const c = await f.changements('s1')
    expect(c).toEqual([{ cle: 'champ:menu-accueil', texte: 'Menu accueil : « Accueil » → « Bienvenue » (sur 5 pages)' }])
  })

  it('compte les listes et les nouvelles pages, pas les pages d’actualité', async () => {
    await f.importerZip('s2', zipSync({ 'index.html': strToU8(page('A')) }))
    const d = f.dossiers('s2')
    await fs.writeFile(path.join(d.brouillon, 'index.html'), page('A').replace('</ul>', '<li data-bf-element><span data-bf="t">Deux</span></li></ul>'))
    await fs.writeFile(path.join(d.brouillon, 'actu-2.html'), '<main data-bf-page="actus"><h1 data-bf="t">Deux</h1></main>')
    await fs.writeFile(path.join(d.brouillon, 'contact.html'), '<h1>Contact</h1>')
    const textes = (await f.changements('s2')).map((x) => x.texte)
    expect(textes).toEqual(['Nouvelle page : contact.html', 'Actus : 1 élément ajouté'])
  })

  it('sans champ reconnu, retombe sur le nombre de fichiers', async () => {
    await f.importerZip('s3', zipSync({ 'index.html': strToU8('<h1>A</h1>'), 'style.css': strToU8('a{}') }))
    await fs.writeFile(path.join(f.dossiers('s3').brouillon, 'style.css'), 'b{}')
    expect((await f.changements('s3')).map((x) => x.texte)).toEqual(['1 fichier modifié'])
  })
})
