import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import crypto from 'crypto'

const publications: Record<string, unknown>[] = []
vi.mock('../config/database', () => ({
  prisma: {
    admin: { findMany: vi.fn(async () => [{ id: 'dev-1' }]) },
    publication: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const p = { id: `p${publications.length + 1}`, createdAt: new Date(), annulee: false, ...data }; publications.push(p); return p }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(publications.find((p) => p.id === where.id)!, data)),
      delete: vi.fn(async () => ({})),
      findMany: vi.fn(async () => publications),
    },
  },
}))

let racine = ''
let dev: typeof import('./dev.service')
let f: typeof import('./site-fichiers.service')

const sha1 = (t: string | Buffer) => crypto.createHash('sha1').update(t).digest('hex')
const b64 = (t: string) => Buffer.from(t).toString('base64')
const lire = (...p: string[]) => fs.readFile(path.join(racine, 's1', ...p), 'utf8')

beforeAll(async () => {
  racine = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-dev-'))
  process.env.SITES_DIR = racine
  f = await import('./site-fichiers.service')
  dev = await import('./dev.service')
  const source = path.join(racine, 'source')
  await fs.mkdir(path.join(source, 'css'), { recursive: true })
  await fs.writeFile(path.join(source, 'index.html'), '<h1 data-bf="titre">Accueil</h1>')
  await fs.writeFile(path.join(source, 'css', 'style.css'), 'h1{}')
  await fs.writeFile(path.join(source, 'vieux.html'), '<p>vieux</p>')
  await f.importer('s1', source)
})
afterAll(() => fs.rm(racine, { recursive: true, force: true }))

describe('manifeste', () => {
  it('donne l’empreinte de chaque fichier en ligne', async () => {
    const m = await dev.manifeste('s1', 'publie')
    expect(m.map((x) => x.chemin)).toEqual(['css/style.css', 'index.html', 'vieux.html'])
    expect(m.find((x) => x.chemin === 'css/style.css')?.sha1).toBe(sha1('h1{}'))
  })
})

describe('envoi depuis Rune', () => {
  const html = '<h1 data-bf="titre">Bienvenue</h1>'
  const demande = (extra = {}) => ({
    manifeste: { 'index.html': sha1(html), 'css/style.css': sha1('h1{color:red}'), 'img/logo.png': sha1('PNG') },
    fichiers: { 'index.html': b64(html) },
    ...extra,
  })

  it('l’essai liste les changements et les fichiers à envoyer, sans rien toucher', async () => {
    const r = await dev.essaiEnvoi('s1', demande())
    expect(r.modifies).toEqual(['index.html'])
    expect(r.manquants.sort()).toEqual(['css/style.css', 'img/logo.png'])
    expect(r.absents).toEqual(['vieux.html'])
    expect(r.supprimes).toEqual([])
    expect(await lire('publie', 'index.html')).toContain('Accueil')
  })

  it('refuse un envoi incomplet', async () => {
    await expect(dev.envoyer('s1', 'dev-1', demande())).rejects.toThrow('manquants')
  })

  it('publie la nouvelle version avec historique, et garde les fichiers absents par défaut', async () => {
    const r = await dev.envoyer('s1', 'dev-1', demande({ fichiers: { 'index.html': b64(html), 'css/style.css': b64('h1{color:red}'), 'img/logo.png': b64('PNG') } }))
    expect(r.publication?.auteur).toBe('dev-1')
    expect(await lire('publie', 'index.html')).toBe(html)
    expect(await lire('brouillon', 'css', 'style.css')).toBe('h1{color:red}')
    expect(await lire('publie', 'vieux.html')).toContain('vieux')
    expect(await lire('historique', 'p1', 'index.html')).toContain('Accueil')
  })

  it('supprime les fichiers absents si demandé', async () => {
    const d = demande({ supprimer: true })
    const r = await dev.essaiEnvoi('s1', d)
    expect(r.manquants).toEqual([])
    expect(r.supprimes).toEqual(['vieux.html'])
    await dev.envoyer('s1', 'dev-1', d)
    await expect(lire('publie', 'vieux.html')).rejects.toThrow()
  })

  it('protège les modifications non publiées du client', async () => {
    await fs.writeFile(path.join(racine, 's1', 'brouillon', 'index.html'), '<h1 data-bf="titre">Modifié par le client</h1>')
    const essai = await dev.essaiEnvoi('s1', demande())
    expect(essai.clientEnAttente.length).toBeGreaterThan(0)
    await expect(dev.envoyer('s1', 'dev-1', demande())).rejects.toThrow('non publiées')
  })

  it('n’accepte pas de chemin qui sort du site', async () => {
    const r = await dev.essaiEnvoi('s1', { manifeste: { 'index.html': sha1(html), '../evasion.html': sha1('x') }, fichiers: { 'index.html': b64(html), '../evasion.html': b64('x') } })
    expect([...r.ajoutes, ...r.manquants]).not.toContain('../evasion.html')
  })
})
