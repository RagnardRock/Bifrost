import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { zipSync, strToU8 } from 'fflate'

let racine = ''
let f: typeof import('./site-fichiers.service')

beforeAll(async () => {
  racine = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-ann-'))
  process.env.SITES_DIR = racine
  f = await import('./site-fichiers.service')
})
afterAll(() => fs.rm(racine, { recursive: true, force: true }))

describe('revenir plusieurs publications en arrière', () => {
  it('annuler de la plus récente à la plus ancienne remet le site d’origine', async () => {
    await f.importerZip('s', zipSync({ 'index.html': strToU8('<h1 data-bf="t">Origine</h1>') }))
    const d = f.dossiers('s')
    const lirePublie = (p: string) => fs.readFile(path.join(d.publie, p), 'utf8')
    const avant = await lirePublie('index.html')
    const pubs: { id: string; diff: Awaited<ReturnType<typeof f.publier>> }[] = []
    for (const [i, t] of ['Un', 'Deux', 'Trois'].entries()) {
      await f.modifierChamp('s', 't', t)
      if (i === 1) await fs.writeFile(path.join(d.brouillon, 'nouvelle.html'), '<p>x</p>')
      pubs.push({ id: `p${i}`, diff: await f.publier('s', `p${i}`) })
    }
    expect(await lirePublie('index.html')).toContain('Trois')
    for (const p of [...pubs].reverse()) await f.annulerPublication('s', p.id, p.diff)
    expect(await lirePublie('index.html')).toBe(avant)
    await expect(fs.access(path.join(d.publie, 'nouvelle.html'))).rejects.toThrow()
    expect(await f.differences('s')).toEqual({ ajoutes: [], modifies: [], supprimes: [] })
  })
})
