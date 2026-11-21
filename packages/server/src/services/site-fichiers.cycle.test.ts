import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import os from 'os'
import path from 'path'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'

let racine = ''
let f: typeof import('./site-fichiers.service')

beforeAll(async () => {
  racine = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-cycle-'))
  process.env.SITES_DIR = racine
  f = await import('./site-fichiers.service')
})
afterAll(() => fs.rm(racine, { recursive: true, force: true }))

describe('pause, export et corbeille d’un site', () => {
  it('la pause pose puis retire la page de pause, sans toucher au site', async () => {
    await f.importerZip('p', zipSync({ 'index.html': strToU8('<h1>Bonjour</h1>') }))
    await f.mettreEnPause('p', 'Club <A&B>', true)
    const page = await fs.readFile(f.fichierPause('p'), 'utf-8')
    expect(page).toContain('Club &lt;A&amp;B&gt;')
    expect(page).toContain('momentanément indisponible')
    expect(existsSync(path.join(f.dossiers('p').publie, 'index.html'))).toBe(true)
    await f.mettreEnPause('p', 'Club', false)
    expect(existsSync(f.fichierPause('p'))).toBe(false)
  })

  it('l’export donne la version en ligne, ou le brouillon', async () => {
    await f.importerZip('e', zipSync({ 'index.html': strToU8('<h1 data-bf="t">En ligne</h1>'), 'css/style.css': strToU8('a{}') }))
    await fs.writeFile(path.join(f.dossiers('e').brouillon, 'index.html'), '<h1 data-bf="t">Brouillon</h1>')
    const enLigne = unzipSync(await f.exporterZip('e'))
    expect(Object.keys(enLigne).sort()).toEqual(['css/style.css', 'index.html'])
    expect(strFromU8(enLigne['index.html']!)).toContain('En ligne')
    expect(strFromU8(unzipSync(await f.exporterZip('e', 'brouillon'))['index.html']!)).toContain('Brouillon')
  })

  it('la corbeille garde fichiers et données, et les remet en place', async () => {
    await f.importerZip('c', zipSync({ 'index.html': strToU8('<h1>Corbeille</h1>') }))
    await f.mettreALaCorbeille('c', { site: { name: 'C' } })
    expect(existsSync(f.dossiers('c').racine)).toBe(false)
    expect(await f.listerCorbeille()).toContain('c')
    expect(await f.lireCorbeille('c')).toEqual({ site: { name: 'C' } })
    await f.sortirDeLaCorbeille('c')
    expect(await fs.readFile(path.join(f.dossiers('c').publie, 'index.html'), 'utf-8')).toContain('Corbeille')
    expect(await f.listerCorbeille()).not.toContain('c')
  })

  it('la corbeille ne passe pas pour un site', () => {
    expect(() => f.dossiers('_corbeille')).toThrow()
  })
})
