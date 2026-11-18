import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { zipSync, strToU8 } from 'fflate'

let racine = ''
let f: typeof import('./site-fichiers.service')

beforeAll(async () => {
  racine = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-test-'))
  process.env.SITES_DIR = racine
  f = await import('./site-fichiers.service')
})
afterAll(() => fs.rm(racine, { recursive: true, force: true }))

const lire = (site: string, ...p: string[]) => fs.readFile(path.join(racine, site, ...p), 'utf8')

describe('importerZip', () => {
  it('prend le contenu du dossier racine et ignore .git', async () => {
    const zip = zipSync({
      'mon-site/index.html': strToU8('<h1>Accueil</h1>'),
      'mon-site/css/style.css': strToU8('h1{}'),
      'mon-site/.git/config': strToU8('x'),
    })
    const r = await f.importerZip('s1', zip)
    expect(r.pages).toContain('index.html')
    expect(await lire('s1', 'publie', 'index.html')).toContain('Accueil')
    expect(await lire('s1', 'brouillon', 'css', 'style.css')).toBe('h1{}')
    await expect(fs.stat(path.join(racine, 's1', 'brouillon', '.git'))).rejects.toThrow()
  })

  it('refuse un envoi sans page HTML, sans toucher au site existant', async () => {
    await expect(f.importerZip('s1', zipSync({ 'a.txt': strToU8('x') }))).rejects.toThrow('Aucune page HTML')
    expect(await lire('s1', 'publie', 'index.html')).toContain('Accueil')
  })

  it('refuse un fichier qui n’est pas un ZIP', async () => {
    await expect(f.importerZip('s1', strToU8('pas un zip'))).rejects.toThrow('ZIP')
  })

  it('ne sort jamais du dossier du site', async () => {
    await f.importerZip('s2', zipSync({ 'index.html': strToU8('ok'), '../../evasion.html': strToU8('non') }))
    await expect(fs.stat(path.join(racine, '..', 'evasion.html'))).rejects.toThrow()
    expect(await lire('s2', 'publie', 'index.html')).toBe('ok')
  })
})
