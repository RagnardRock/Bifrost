import { describe, it, expect, vi, beforeEach } from 'vitest'

const sites = [
  { id: 's1', url: 'https://www.MonAsso.fr/' },
  { id: 's2', url: 'garage-martin.com' },
  { id: 's3', url: 'https://bifrost.exemple.fr' },
  { id: 's4', url: 'http://192.168.1.10' },
]
vi.mock('../config/database', () => ({ prisma: { site: { findMany: vi.fn(async () => sites) } } }))
vi.mock('../config', () => ({ config: { appUrl: 'https://bifrost.exemple.fr' } }))

const d = await import('./domaines.service')
beforeEach(() => d.oublierDomaines())

describe('domaines des clients', () => {
  it('normalise les adresses saisies dans la fiche', () => {
    expect(d.normaliser('https://www.MonAsso.fr/contact')).toBe('monasso.fr')
    expect(d.normaliser('monasso.fr:443')).toBe('monasso.fr')
    expect(d.normaliser('localhost')).toBeNull()
    expect(d.normaliser('10.0.0.1')).toBeNull()
    expect(d.normaliser('')).toBeNull()
  })

  it('trouve le site par son domaine, avec ou sans www', async () => {
    expect(await d.siteParDomaine('monasso.fr')).toBe('s1')
    expect(await d.siteParDomaine('www.monasso.fr')).toBe('s1')
    expect(await d.siteParDomaine('GARAGE-MARTIN.com:443')).toBe('s2')
  })

  it('refuse les domaines inconnus et celui de Bifrost (certificats demandés au hasard)', async () => {
    expect(await d.autoriser('inconnu.fr')).toBe(false)
    expect(await d.autoriser('bifrost.exemple.fr')).toBe(false)
    expect(await d.autoriser(undefined)).toBe(false)
    expect(await d.autoriser('www.garage-martin.com')).toBe(true)
  })
})
